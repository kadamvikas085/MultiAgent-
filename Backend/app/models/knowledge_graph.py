from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class KnowledgeGraphNode(Base, UUIDMixin, TimestampMixin):
    """
    Relational mirror of a Neo4j node so we can query/paginate node lists
    from Postgres without round-tripping to the graph DB for list views.
    """

    __tablename__ = "kg_nodes"

    neo4j_node_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(128), nullable=False)  # Product, Category, Attribute...
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    properties: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    source_product_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("products.id"), nullable=True
    )


class KnowledgeGraphEdge(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "kg_edges"

    neo4j_edge_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    relationship: Mapped[str] = mapped_column(String(128), nullable=False)  # BELONGS_TO, COMPATIBLE_WITH...
    source_node_id: Mapped[UUID] = mapped_column(ForeignKey("kg_nodes.id"), nullable=False)
    target_node_id: Mapped[UUID] = mapped_column(ForeignKey("kg_nodes.id"), nullable=False)
    properties: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


