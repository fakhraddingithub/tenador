---
name: tenador-products
description: Create or regenerate Tenador products from a reference URL or raw content using the connected Tenador MCP and independent Claude Code subagents for factual analysis, writing, catalog preparation, and final review. Use for product-authoring requests, not repository development or general product recommendations.
---

# Tenador products in Claude Code

All model work happens here, in Claude Code subagents; the Tenador server supplies the current admin rules and data, imports images, validates and saves. This needs the Tenador MCP server connected under the name `tenador` (see `docs/product-mcp.md`). If its tools are missing, say so and stop.

## The workflow lives on the server

1. Find the category with `list_product_categories`, or the existing product with `search_products`.
2. Call `start_product_job` with a stable `requestKey`, the source URL or raw content, and the category ID (or product ID for regeneration).
3. Follow `preparation.workflow` from that response exactly. It is the one authoritative copy of the roles, what each agent receives, validation, review and saving. For an interrupted request, use `get_product_job` / `resume_product_job` with the same `jobId` instead of a new job.

## How the roles map to Claude Code

You, the main session, are the coordinator: the only one that calls `import_product_images`, `validate_product_draft`, `review_product_draft`, `create_product`, `preview_product_regeneration` and `apply_product_regeneration`.

| role | subagent | its tools |
|---|---|---|
| analyst | `tenador-analyst` | none of Tenador's |
| writer | `tenador-writer` | none of Tenador's |
| catalogue/images | `tenador-catalog` | read-only Tenador tools |
| reviewer | `tenador-reviewer` | none of Tenador's |

- Give each agent, in its prompt, its role paragraph from `preparation.workflow` plus exactly the material that paragraph lists. The agents start with empty context and know nothing else.
- Start the writer and the catalogue specialist in the same message, so they run in parallel.
- Each Agent result reports an `agentId`. Pass the analyst's, writer's and reviewer's actual IDs to `review_product_draft`; never invent them.
- To revise, send the reviewer's issues to the same writer or catalogue agent with SendMessage (it keeps its context), then validate again and send the revised JSON to the reviewer. Use a new reviewer only if the old one cannot continue.
- Ask the user only for missing facts or choices. If they asked to see a regeneration preview first, show it and wait. Use `replace_product_images` only on an explicit request.
