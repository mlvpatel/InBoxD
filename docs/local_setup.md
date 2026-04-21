# Local Setup
last_updated: 2026-04-21

This document provides the complete setup procedure for the local variant of the Email Classifier.

## Prerequisites

1. Docker Desktop installed and running.
2. A Microsoft account with access to Outlook (for email integration).
3. Sufficient disk space for Ollama models (approximately 5 GB for qwen2.5:7b-instruct and 2 GB for bge-m3).
4. Sufficient RAM for local inference (minimum 8 GB recommended, 16 GB preferred).

## Step 1: Install Ollama

1. Download Ollama from https://ollama.com/download.
2. Install and verify with `ollama --version`.
3. Ollama runs as a background service on port 11434 by default.

## Step 2: Pull Required Models

1. Pull the instruction-tuned language model:
   ```
   ollama pull qwen2.5:7b-instruct
   ```
2. Pull the embedding model:
   ```
   ollama pull bge-m3
   ```
3. Verify both models are available with `ollama list`.

## Step 3: Start Qdrant

Qdrant provides the vector database for embedding-based fuzzy product matching.

1. Start Qdrant using the Docker Compose file:
   ```
   docker compose -f docker/docker-compose.local.yml up qdrant -d
   ```
2. Verify Qdrant is running by visiting http://localhost:6333/dashboard in a browser.

Alternatively, start Qdrant standalone:
```
docker run -p 6333:6333 -p 6334:6334 -v qdrant_storage:/qdrant/storage qdrant/qdrant:v1.13.2
```

## Step 4: Seed the Vector Database

1. Install Python dependencies:
   ```
   pip install -r scripts/requirements.txt
   ```
2. Run the seeding script:
   ```
   python3 scripts/seed_qdrant.py
   ```
3. The script reads the Inventory sheet from `data/Inventory.xlsx and Deliveries.xlsx`, generates embeddings for each product using bge-m3 via Ollama, and upserts them into the `inventory_products` collection in Qdrant.
4. The script is idempotent. Re-running it skips unchanged rows based on a local cache file (`.seed_cache.json`).
5. Verify the collection exists at http://localhost:6333/dashboard with 50 points.

## Step 5: Configure Environment Variables

1. Copy `.env.example` to `.env`.
2. Fill in the following values:

| Variable | Value |
|---|---|
| N8N_BASIC_AUTH_USER | Choose an admin username |
| N8N_BASIC_AUTH_PASSWORD | Choose a strong password |
| N8N_ENCRYPTION_KEY | A random string for credential encryption |
| MICROSOFT_CLIENT_ID | From Azure app registration |
| MICROSOFT_CLIENT_SECRET | The secret **Value** (not the ID) |
| MICROSOFT_TENANT_ID | From Azure app registration |
| OLLAMA_HOST | http://ollama:11434 (Docker) or http://localhost:11434 (standalone) |
| QDRANT_HOST | http://qdrant:6333 (Docker) or http://localhost:6333 (standalone) |
| LOCAL_EXCEL_PATH | /data/Inventory.xlsx and Deliveries.xlsx (Docker mount) |
| QDRANT_SCORE_THRESHOLD | 0.82 |
| QDRANT_GAP_THRESHOLD | 0.05 |

For Azure Entra ID app registration steps, refer to Steps 3a through 3d in [cloud_setup.md](cloud_setup.md).

## Step 6: Start All Services

1. Navigate to the project root.
2. Start all three services:
   ```
   docker compose -f docker/docker-compose.local.yml up -d
   ```
3. Verify all containers are running with `docker ps`.
4. Open http://localhost:5678 in a browser and log in.

## Step 7: Create n8n Credentials

### 7a: Microsoft Outlook OAuth2

1. In n8n, go to Settings, then Credentials.
2. Add a "Microsoft Outlook OAuth2 API" credential.
3. Enter the Client ID and Client Secret.
4. Complete the OAuth2 flow.
5. Name the credential "Outlook account".

### 7b: Ollama (Optional)

The Ollama connection uses the OLLAMA_HOST environment variable directly in the workflow nodes. No separate n8n credential is required in most configurations.

## Step 8: Import and Activate the Workflow

1. In n8n, go to Workflows.
2. Import `workflows/local/workflow.json`.
3. Verify all nodes show the correct credentials and environment variable references.
4. Activate the workflow.

## Step 9: Test the Workflow

1. Send a test email to the monitored inbox.
2. Wait up to one minute for the polling trigger.
3. Check the Outlook Drafts folder for the generated reply.
4. Review the n8n execution log.

## Performance Notes

| Operation | Typical Latency |
|---|---|
| Stage 1 classification (Ollama qwen2.5:7b) | 2 to 5 seconds |
| Stage 2 draft generation (Ollama qwen2.5:7b) | 3 to 8 seconds |
| Qdrant embedding search | Under 100 milliseconds |
| End-to-end pipeline | 8 to 20 seconds |

Latency depends on hardware. GPU acceleration reduces inference time significantly.

## Troubleshooting

| Issue | Resolution |
|---|---|
| Ollama connection refused | Verify Ollama is running and OLLAMA_HOST is correct |
| Qdrant collection empty | Re-run seed_qdrant.py and check the Ollama bge-m3 model is available |
| Embedding dimension mismatch | Ensure bge-m3 is the model used (1024 dimensions) |
| Slow inference | Consider GPU passthrough for the Ollama container |
