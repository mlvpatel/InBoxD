# Cloud vs Local Comparison
last_updated: 2026-04-21

This document provides a decision matrix comparing the cloud and local variants of the Email Classifier across key operational dimensions.

## Decision Matrix

| Dimension | Cloud Variant | Local Variant | Recommendation |
|---|---|---|---|
| **Latency (end-to-end)** | 3 to 8 seconds | 8 to 20 seconds | Cloud for latency-sensitive deployments |
| **Per-email Cost** | ~EUR 0.002 (gpt-4o-mini tokens) | EUR 0 (hardware amortized) | Local for high-volume processing |
| **Data Residency** | Sent to OpenAI (US) and Microsoft (regional) | All processing stays on-premises | Local for GDPR-sensitive environments |
| **Offline Capability** | Requires internet for LLM and Excel API | Fully offline after model download | Local for air-gapped environments |
| **Database Scale** | OneDrive Excel (limited by API rate limits) | Local Excel plus Qdrant vector search | Local for larger catalogs |
| **Matching Tiers** | 2 (exact, substring) | 3 (exact, substring, embedding) | Local for fuzzy matching needs |
| **Setup Complexity** | Moderate (Azure OAuth, OpenAI key) | Higher (Ollama, Qdrant, model downloads) | Cloud for rapid deployment |
| **Model Quality** | gpt-4o-mini (high accuracy) | qwen2.5:7b-instruct (good accuracy) | Cloud for maximum accuracy |
| **Hardware Requirements** | Any machine running Docker | 8+ GB RAM, GPU recommended | Cloud for limited hardware |
| **Audit Trail** | Execution logs in n8n | Execution logs in n8n plus local retention | Local for audit requirements |
| **Multilingual Quality** | Strong (gpt-4o-mini) | Good (qwen2.5:7b-instruct, bge-m3) | Cloud for diverse languages |
| **Anti-Hallucination** | Prompt + Scrub + Firewall | Prompt + Scrub + Firewall + Embedding Validation | Local for maximum safety |
| **Alternative LLMs** | Any compatible API provider (API swap) | Any GGUF-compatible model via Ollama | Both support provider flexibility |

## Detailed Analysis

### Latency

The cloud variant achieves lower latency because gpt-4o-mini responses are optimized for speed, and the Microsoft Excel API returns structured data without local file parsing overhead. The local variant adds inference latency from running a 7B parameter model on CPU (or GPU), plus the time for embedding generation when the Qdrant tier is engaged. With a dedicated GPU (RTX 4060 or above), local inference latency drops to 4 to 10 seconds.

### Cost

The cloud variant incurs per-token pricing from OpenAI. At current gpt-4o-mini rates, each email classification costs approximately EUR 0.001 and each draft generation costs approximately EUR 0.001, totaling roughly EUR 0.002 per email. The local variant has zero marginal cost per email but requires upfront hardware investment for adequate inference performance. At 1,000 emails per day, the cloud variant costs roughly EUR 60 per month compared to EUR 0 for local.

### Data Residency

The cloud variant sends email body text to OpenAI for classification and draft generation. While OpenAI has data processing agreements available, the text does leave the organization's infrastructure. The local variant processes all data entirely on-premises. For organizations subject to GDPR Article 44 restrictions on international data transfers, the local variant eliminates compliance complexity entirely.

### Offline Capability

The cloud variant requires internet connectivity for every email processed (OpenAI API, Microsoft Graph API for Excel). The local variant can operate fully offline after the initial model download and Qdrant seeding. Outlook trigger functionality still requires network access to the Outlook mailbox, but the LLM and database operations are entirely local.

### Matching Quality

The local variant includes the Qdrant embedding tier, which catches product name variations that exact and substring matching miss. This is particularly valuable for:

1. Misspelled product names (e.g., "TekPro" instead of "TechPro").
2. Cross-language queries (e.g., Italian abbreviations of English product names).
3. Partial or informal product references.

The cloud variant relies on exact and substring matching only, which is sufficient for well-formed queries but may produce more "not_found_draft" responses for edge cases.

### Anti-Hallucination Controls

Both variants share three identical defense layers: prompt-level constraints forbidding fabrication, a data packet firewall stripping internal fields, and a post-LLM scrub node sweeping residual placeholders and markdown. The local variant adds a fourth layer through embedding-based validation, where product matches are verified against cosine similarity thresholds before reaching the drafter.

## When to Choose Cloud

1. Rapid deployment is the priority.
2. Email volume is low to moderate (under 100 per day).
3. Maximum classification accuracy is required.
4. The organization permits cloud data processing.
5. Hardware resources are limited.

## When to Choose Local

1. Data must remain on-premises for regulatory reasons.
2. Email volume is high (zero marginal cost per email).
3. Fuzzy product matching via embeddings is needed.
4. Offline operation is required.
5. A full audit trail with local data retention is mandated.
