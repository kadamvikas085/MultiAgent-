"""
Pipeline Graph
--------------
Wires the 8 agents into a LangGraph StateGraph matching the product-spec flow:

  OCR -> Document Parsing -> Extraction -> Knowledge Graph -> Validation
      -> RAG/Reasoning -> SEO -> Recommendation -> Compliance -> QA
      -> (conditional) Human Review -> Generated Product

Note: OCR + Document Parsing happen upstream in the Celery task (see
app/workers/tasks.py) via the OCR/Unstructured services, because they're
I/O-heavy and don't need LLM reasoning. This graph starts from Extraction,
which is the first "AI agent" step, through to QA.
"""
from langgraph.graph import END, StateGraph

from app.agents.compliance_agent import ComplianceAgent
from app.agents.extraction_agent import ExtractionAgent
from app.agents.knowledge_graph_agent import KnowledgeGraphAgent
from app.agents.qa_agent import QualityAssuranceAgent
from app.agents.reasoning_agent import ReasoningAgent
from app.agents.recommendation_agent import RecommendationAgent
from app.agents.seo_agent import SEOAgent
from app.agents.validation_agent import ValidationAgent
from app.graphs.state import PipelineState
from app.services.graph_db_service import GraphDBService
from app.services.llm_service import get_llm_service
from app.services.vector_store_service import VectorStoreService


def route_after_qa(state: PipelineState) -> str:
    return "human_review" if state.get("requires_human_review") else END


def build_pipeline_graph():
    # USE_MOCK_LLM (see app/core/config.py) decides mock vs real here, and
    # nowhere else — every agent below just gets "a" llm_service and doesn't
    # know or care which implementation it is.
    llm_service = get_llm_service()
    vector_store = VectorStoreService()
    graph_db = GraphDBService()

    extraction_agent = ExtractionAgent(llm_service)
    validation_agent = ValidationAgent(llm_service)
    reasoning_agent = ReasoningAgent(llm_service, vector_store)
    kg_agent = KnowledgeGraphAgent(llm_service, graph_db)
    seo_agent = SEOAgent(llm_service)
    recommendation_agent = RecommendationAgent(llm_service, vector_store, graph_db)
    compliance_agent = ComplianceAgent(llm_service)
    qa_agent = QualityAssuranceAgent(llm_service)

    graph = StateGraph(PipelineState)

    graph.add_node("extraction", extraction_agent)
    graph.add_node("validation", validation_agent)
    graph.add_node("reasoning", reasoning_agent)
    graph.add_node("knowledge_graph", kg_agent)
    graph.add_node("seo", seo_agent)
    graph.add_node("recommendation", recommendation_agent)
    graph.add_node("compliance", compliance_agent)
    graph.add_node("qa", qa_agent)

    graph.set_entry_point("extraction")
    graph.add_edge("extraction", "validation")
    graph.add_edge("validation", "reasoning")
    graph.add_edge("reasoning", "knowledge_graph")
    graph.add_edge("knowledge_graph", "seo")
    graph.add_edge("seo", "recommendation")
    graph.add_edge("recommendation", "compliance")
    graph.add_edge("compliance", "qa")

    graph.add_conditional_edges(
        "qa",
        route_after_qa,
        {"human_review": END, END: END},  # human_review pauses the graph; a
        # reviewer's Approve/Reject in the Validation Center triggers a
        # separate finalize step rather than resuming this same graph run.
    )

    return graph.compile()


# Compiled once per worker process, reused across jobs.
pipeline_graph = build_pipeline_graph()


