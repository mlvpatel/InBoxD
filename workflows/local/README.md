# Local Workflow
last_updated: 2026-04-21

This directory contains the n8n workflow JSON for the local variant of the Email Classifier.

## Variant Details

1. LLM: Ollama qwen2.5:7b-instruct running locally via the n8n LangChain Ollama chat model node.
2. Database: Local Excel file read via the n8n Read Binary File and Spreadsheet File nodes.
3. Vector Search: Qdrant with bge-m3 embeddings for fuzzy product matching (optional tier).
4. Email: Outlook via Microsoft Graph API with OAuth2 credentials.

## File

`workflow.json` contains the complete n8n workflow definition. Import this file directly into n8n.

## Differences from Cloud Variant

1. LLM nodes use Ollama instead of OpenAI.
2. Excel nodes use Read Binary File plus Spreadsheet File instead of Microsoft Excel API.
3. Matcher node includes an optional third tier: Qdrant embedding search with bge-m3.
4. Embedding tier accepts matches with cosine similarity above 0.82 and gap above 0.05.

## Node Summary

| Node | Name | Purpose |
|------|------|---------|
| 1 | Outlook Trigger | Polls Inbox every minute for new messages |
| 2 | Dedup | Prevents reprocessing using global static data |
| 3 | Thread Stripper | Removes HTML and quoted reply history |
| 4 | Extract and Classify Stage 1 | LLM call via Ollama |
| 4b | Parse Stage 1 JSON | Parses LLM output with fallback defaults |
| 5 | Route by Intent | Switch node routing to correct data path |
| 6a | Load Inventory | Reads Inventory sheet from local Excel file |
| 6b | Load Deliveries | Reads Active_Deliveries sheet from local Excel file |
| 7 | Matcher | Three-tier matching (exact, substring, embedding) |
| 7u | Unknown Packet | Handles unknown intent routing |
| 8 | Compose Data Packet | Builds intent-specific data for drafter |
| 9 | Draft Reply Stage 2 | LLM call via Ollama to generate reply |
| 10 | Scrub Format | Removes markdown artifacts from draft |
| 11 | Compose Subject | Adds Re: prefix to subject |
| 12 | Create Outlook Draft | Creates draft in Outlook |
| 13 | Mark Processed | Records message ID to prevent reprocessing |

## Prerequisites

1. Ollama installed with qwen2.5:7b-instruct and bge-m3 models pulled.
2. Qdrant running (via Docker or standalone) with the inventory_products collection seeded.
3. The Inventory.xlsx and Deliveries.xlsx at the LOCAL_EXCEL_PATH location.
4. An Azure Entra ID app registration for Outlook access.

See [docs/local_setup.md](../../docs/local_setup.md) for the full setup procedure.
