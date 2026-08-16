from fastapi import APIRouter, Depends, Query

from app.core.security import get_current_user
from app.models.user import User
from app.services.graph_db_service import GraphDBService


router = APIRouter(
    prefix="/knowledge-graph",
    tags=["Knowledge Graph"],
)

graph_db = GraphDBService()


@router.get("/nodes")
async def list_nodes(
    search: str | None = None,
    label: str | None = None,
    current_user: User = Depends(get_current_user),
):
    """
    Return Knowledge Graph nodes directly from Neo4j.

    This replaces the previous PostgreSQL-backed read path.
    The graph itself is maintained in Neo4j by GraphDBService.
    """

    return await graph_db.get_graph_nodes(
        search=search,
        label=label,
        limit=200,
    )


@router.get("/nodes/{node_id}/expand")
async def expand_node(
    node_id: str,
    depth: int = Query(
        1,
        ge=1,
        le=3,
    ),
    current_user: User = Depends(get_current_user),
):
    """
    Return the neighborhood of a graph node.

    Existing endpoint is preserved so the frontend/API contract
    does not change.
    """

    return await graph_db.get_graph_subview(
        node_id=node_id,
        depth=depth,
    )


@router.get("/edges")
async def list_edges(
    current_user: User = Depends(get_current_user),
):
    """
    Return Knowledge Graph relationships directly from Neo4j.
    """

    return await graph_db.get_graph_edges(
        limit=500,
    )