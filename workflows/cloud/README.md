# Cloud Workflow
last_updated: 2026-04-21

This directory contains the n8n workflow JSON for the cloud variant of the Email Classifier.

## Variant Details

1. LLM: OpenAI gpt-4o-mini via the n8n LangChain OpenAI chat model node.
2. Database: Microsoft 365 Excel on OneDrive accessed via the n8n Microsoft Excel node.
3. Email: Outlook via Microsoft Graph API with OAuth2 credentials.

## File

`workflow.json` contains the complete n8n workflow definition with all nodes, connections, and settings. Import this file directly into n8n via the workflow import feature.

## Node Summary

| Node | Name | Purpose |
|------|------|---------|
| 1 | Outlook Trigger | Polls Inbox every minute for new messages |
| 2 | Dedup | Prevents reprocessing using global static data |
| 3 | Thread Stripper | Removes HTML and quoted reply history |
| 4 | Extract and Classify Stage 1 | LLM call to extract intent and product |
| 4b | Parse Stage 1 JSON | Parses LLM output with fallback defaults |
| 5 | Route by Intent | Switch node routing to correct data path |
| 6a | Load Inventory | Reads Inventory sheet from OneDrive Excel |
| 6b | Load Deliveries | Reads Active_Deliveries sheet from OneDrive Excel |
| 7 | Matcher | Two-tier product matching (exact, substring) |
| 7u | Unknown Packet | Handles unknown intent routing |
| 8 | Compose Data Packet | Builds intent-specific data for drafter |
| 9 | Draft Reply Stage 2 | LLM call to generate reply text |
| 10 | Scrub Format | Removes markdown artifacts from draft |
| 11 | Compose Subject | Adds Re: prefix to subject |
| 12 | Create Outlook Draft | Creates draft in Outlook |
| 13 | Mark Processed | Records message ID to prevent reprocessing |

## Prerequisites

1. An Azure Entra ID app registration with Mail.ReadWrite and Mail.Send permissions.
2. An OpenAI API key with access to gpt-4o-mini.
3. The Inventory.xlsx and Deliveries.xlsx uploaded to OneDrive.
4. The ONEDRIVE_EXCEL_PATH environment variable set to the workbook path.

See [docs/cloud_setup.md](../../docs/cloud_setup.md) for the full setup procedure.
