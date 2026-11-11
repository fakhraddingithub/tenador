---
name: tenador-products
description: Create or regenerate Tenador products from a reference URL or raw content using the connected Tenador MCP and independent Codex subagents for factual analysis, writing, catalog preparation, and final review. Use for product-authoring requests, not repository development or general product recommendations.
---

# Tenador products in Codex

All model work happens in Codex with the host's native subagent tools; the Tenador server supplies the current admin rules and data, imports images, validates, and saves. Do not call model-provider APIs, start a worker, or launch a model CLI. The user asked for independent agents, so role-playing several agents in one context does not satisfy this request. If native delegation or the Tenador MCP tools are unavailable, say which capability is missing and stop before saving.

## The workflow lives on the server

1. Find the category with `list_product_categories`, or the existing product with `search_products`.
2. Call `start_product_job` with a stable `requestKey`, the source URL or raw content, and the category ID (or product ID for regeneration).
3. Follow `preparation.workflow` from that response exactly. It is the one authoritative copy of the roles, what each agent receives, validation, review and saving, and it is updated with each deploy. Do not follow a remembered or older version of it.

For an existing or interrupted request, call `get_product_job` (or `resume_product_job`) with the same `jobId` instead of starting a new job.

## Host notes not covered by the workflow

- Keep the actual agent IDs your host issues for `review_product_draft`; never invent them.
- Ask the user only for missing facts or choices; do not ask again for permission already given.
- If the user asked to see a regeneration preview before it is applied, show it and wait.
- Use `replace_product_images` only when the user explicitly asks to replace an existing product's images.
- If missing evidence or capabilities block approval, report the concrete blocker; never save or fabricate an approval to get past it.
