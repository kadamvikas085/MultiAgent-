"""
Graph DB Service (Neo4j)
--------------------------
Handles writing product/attribute/category nodes and relationships, duplicate
detection, and related-product lookups for the Knowledge Graph and
Recommendation agents, plus read queries for the Knowledge Graph explorer UI.
"""

from neo4j import AsyncGraphDatabase

from app.core.config import settings


class GraphDBService:
    def __init__(self):
        self.driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(
                settings.NEO4J_USER,
                settings.NEO4J_PASSWORD,
            ),
        )

    async def close(self) -> None:
        await self.driver.close()

    async def find_similar_product(
        self,
        name: str,
        sku: str | None,
    ) -> str | None:
        query = """
        MATCH (p:Product)
        WHERE
            toLower(p.name) = toLower($name)
            OR ($sku IS NOT NULL AND p.sku = $sku)
        RETURN p.id AS id
        LIMIT 1
        """

        async with self.driver.session() as session:
            result = await session.run(
                query,
                name=name,
                sku=sku,
            )

            record = await result.single()

            return record["id"] if record else None

    async def upsert_product_graph(
        self,
        fields: dict,
    ) -> tuple[list[dict], list[dict]]:
        """
        Create/update the product graph.

        IMPORTANT:
        Existing graph-writing behavior is preserved.
        This method is not changed by the Knowledge Graph explorer fix.
        """

        query = """
        MERGE (p:Product {name: $name})
        SET
            p.sku = $sku,
            p.description = $description

        WITH p

        FOREACH (
            cat IN CASE
                WHEN $category IS NULL
                THEN []
                ELSE [$category]
            END |
                MERGE (c:Category {name: cat})
                MERGE (p)-[:BELONGS_TO]->(c)
        )

        FOREACH (
            app IN $applications |
                MERGE (a:Application {name: app})
                MERGE (p)-[:USED_FOR]->(a)
        )

        RETURN p.id AS product_id
        """

        async with self.driver.session() as session:
            await session.run(
                query,
                name=fields.get(
                    "name",
                    "Unnamed Product",
                ),
                sku=fields.get("sku"),
                description=fields.get("description"),
                category=fields.get("category"),
                applications=fields.get("applications") or [],
            )

        # Return a lightweight node/edge summary for the pipeline state.
        # The full graph is fetched separately by the Knowledge Graph
        # explorer API.

        nodes = [
            {
                "label": "Product",
                "name": fields.get("name"),
            }
        ]

        if fields.get("category"):
            nodes.append(
                {
                    "label": "Category",
                    "name": fields["category"],
                }
            )

        edges = (
            [{"relationship": "BELONGS_TO"}]
            if fields.get("category")
            else []
        )

        return nodes, edges

    async def find_related_products(
        self,
        category: str | None,
        applications: list[str] | None,
    ) -> list[dict]:
        if not category and not applications:
            return []

        query = """
        MATCH (p:Product)-[:BELONGS_TO|USED_FOR]->(shared)
        WHERE
            shared.name = $category
            OR shared.name IN $applications

        RETURN DISTINCT
            p.id AS product_id,
            p.name AS name

        LIMIT 10
        """

        async with self.driver.session() as session:
            result = await session.run(
                query,
                category=category,
                applications=applications or [],
            )

            return [
                dict(record)
                async for record in result
            ]

    # ------------------------------------------------------------------
    # Knowledge Graph Explorer
    # ------------------------------------------------------------------

    async def get_graph_nodes(
        self,
        search: str | None = None,
        label: str | None = None,
        limit: int = 200,
    ) -> list[dict]:
        """
        Return Knowledge Graph nodes directly from Neo4j.

        READ ONLY.

        The generated ID format is:

            Label:name

        Example:

            Product:Industrial Motor A
            Category:Industrial Components
            Application:General industrial use

        The same ID format is used by get_graph_edges() so the frontend
        can correctly connect nodes and edges.
        """

        query = """
        MATCH (n)
        WHERE
            (
                $search IS NULL
                OR toLower(
                    coalesce(
                        toString(n.name),
                        ""
                    )
                ) CONTAINS toLower($search)
            )
            AND
            (
                $label IS NULL
                OR $label IN labels(n)
            )

        RETURN
            CASE
                WHEN n.name IS NOT NULL
                THEN
                    toString(head(labels(n)))
                    + ":"
                    + toString(n.name)
                ELSE
                    elementId(n)
            END AS id,

            coalesce(
                toString(n.name),
                "Unnamed"
            ) AS name,

            head(labels(n)) AS label

        ORDER BY name
        LIMIT $limit
        """

        async with self.driver.session() as session:
            result = await session.run(
                query,
                search=search,
                label=label,
                limit=limit,
            )

            return [
                dict(record)
                async for record in result
            ]

    async def get_graph_edges(
        self,
        limit: int = 500,
    ) -> list[dict]:
        """
        Return Knowledge Graph relationships directly from Neo4j.

        READ ONLY.

        IMPORTANT:
        The frontend expects these exact field names:

            source_node_id
            target_node_id
            relationship

        The node IDs use exactly the same format as get_graph_nodes():

            Label:name

        Example:

            {
                "source_node_id": "Product:Industrial Motor A",
                "target_node_id": "Category:Industrial Components",
                "relationship": "BELONGS_TO"
            }

        This keeps the backend/frontend graph contract consistent.
        """

        query = """
        MATCH (a)-[r]->(b)

        RETURN
            CASE
                WHEN a.name IS NOT NULL
                THEN
                    toString(head(labels(a)))
                    + ":"
                    + toString(a.name)
                ELSE
                    elementId(a)
            END AS source_node_id,

            CASE
                WHEN b.name IS NOT NULL
                THEN
                    toString(head(labels(b)))
                    + ":"
                    + toString(b.name)
                ELSE
                    elementId(b)
            END AS target_node_id,

            type(r) AS relationship

        ORDER BY
            source_node_id,
            target_node_id,
            relationship

        LIMIT $limit
        """

        async with self.driver.session() as session:
            result = await session.run(
                query,
                limit=limit,
            )

            return [
                dict(record)
                async for record in result
            ]

    async def get_graph_subview(
        self,
        node_id: str | None,
        depth: int = 1,
    ) -> dict:
        """
        Powers the interactive Knowledge Graph explorer.

        Existing behavior is preserved.

        This endpoint is currently retained for future interactive
        expand functionality. The current frontend loads the complete
        node and edge lists through get_graph_nodes() and
        get_graph_edges().
        """

        query = """
        MATCH (n)-[r*1..$depth]-(m)
        WHERE
            $node_id IS NULL
            OR n.id = $node_id

        RETURN
            n,
            r,
            m

        LIMIT 200
        """

        async with self.driver.session() as session:
            result = await session.run(
                query,
                node_id=node_id,
                depth=depth,
            )

            records = [
                record
                async for record in result
            ]

            return {
                "raw_records": len(records)
            }