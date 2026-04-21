# Agentic RAG & Local Fine-Tuning Architecture
last_updated: 2026-04-21

This plan defines a scalable, hallucination-resistant email classification and response architecture capable of querying up to **1,000,000+ structured records and unstructured documents** with 90%+ retrieval accuracy.

## Goals

1. **Local Fine-Tuning**: Eliminate reliance on heavy prompt engineering. Fine-tune `Qwen2.5-7B` (and `Qwen2.5-1.5B` for classification) to natively output deterministic JSON. Actively avoid bloated models (32B, 70B) in favor of specialized, efficient weights that perfectly execute their narrow task.
2. **Advanced RAG Engine**: Implement "Retrieve and Re-rank" pipelines featuring Corrective RAG (CRAG) and RAG-Fusion for production-grade retrieval at massive scale.

---

## 1. Architectural Principles and ADR Strategy

Core principle: *"Simplicity is the ultimate sophistication."* Start simple, add complexity only when proven necessary.

The current architecture (single-tier vector matching) remains operational and effective for catalogs under 50,000 rows. The introduction of Hybrid Search, LoRA Fine-Tuning, and Reranking is justified only because single-tier cosine similarity mathematically degrades past that threshold.

### ADR Protocol (Applied to Every Major Decision)

| Step | Action |
| :--- | :--- |
| Context | What problem exists, what constraints apply |
| Options | 2 to 4 viable approaches (never just one) |
| Trade-offs | Pros, cons, cost, complexity, risk per option |
| Recommendation | Pick one with explicit reasoning |
| Consequences | What this locks in, what it closes off |

### Key ADRs Required

| Decision | Options Under Evaluation |
| :--- | :--- |
| Vector DB Selection | Qdrant (self-hosted) vs Weaviate vs Pinecone (managed) |
| Embedding Model | bge-m3 (multilingual) vs e5-mistral (high retrieval) vs ColBERT (late interaction) |
| Sparse Encoder | SPLADE vs BM25 (Elasticsearch) vs TF-IDF baseline |
| Fine-Tuning Framework | Unsloth (NVIDIA) vs MLX (Apple Silicon) vs Axolotl |
| Reranker Model | bge-reranker-large vs Cohere Rerank vs cross-encoder/ms-marco |

---

## 2. Hardware Requirements for Native Local Processing

| System Environment | Minimum (Local LoRA + Inference) | Maximum Scale (Enterprise Speed) | Optimization Framework |
| :--- | :--- | :--- | :--- |
| **PC / Linux Workstation** | **NVIDIA RTX 4060** (16GB VRAM), 32GB RAM | **NVIDIA**: 2x to 4x RTX 4090 / A100 (80GB). **AMD**: Radeon RX 7900 XTX (24GB VRAM) or Instinct MI300X accelerators. | **Unsloth**: 2x faster, 70% less memory via Flash Attention and triton kernels. AMD requires ROCm 6.x stack. |
| **Mac (Apple Silicon)** | M2/M3/M4 with **24GB Unified Memory** minimum | **Mac Studio** (M2 Ultra, 192GB unified memory) or **Mac Mini** (M4 Pro, 64GB unified memory) | **Apple MLX Framework**: Leverages unified memory architecture to fine-tune 7B to 14B models natively without out-of-memory crashes. |

---

## 3. Capacity Estimation

| Metric | Target State |
| :--- | :--- |
| Catalog Size | Up to 1,000,000 records (products, policies, manuals, warranty documents) |
| Concurrent Email Streams | 50 to 200 parallel processing pipelines |
| Throughput | 20 to 50 classified and drafted emails per minute |
| Latency (P95, end-to-end) | Under 8 seconds from ingestion to draft creation |
| Vector DB Storage | 10 to 50 GB covering dense and sparse indices |
| Read/Write Ratio | 95:5 (primarily read queries with optional live inventory API writes) |

---

## 4. Methodology: Achieving 90%+ Accuracy

Accuracy depends on defensively engineered code, not raw model size. Four layers enforce the 90% floor:

### Layer 1: Structured LLM Enforcement
Using `Pydantic` models with `Instructor` forces the LLM to output valid, typed JSON. If parsing fails, the code loop automatically retries with corrective context (up to 3 attempts) before falling back to a clarification draft.

### Layer 2: Deterministic Fallbacks (Defensive Engineering)
For high-stakes data (inventory counts, pricing), semantic similarity alone is untrustworthy. The code executes a deterministic override (Exact Regex and Part Number Match) *before* relying on the LLM, maintaining classical compute stability as the first line of defense.

### Layer 3: Anti-Hallucination Protocol (5-Point Enforcement)

| Control | Implementation |
| :--- | :--- |
| File-grounded | Read database before claiming any value. Never invent data. |
| Version-locked | Exact package versions in all requirements files. |
| Uncertainty-flagged | If confidence is below 0.6, route to clarification. Never fabricate. |
| Source-linked | Every drafted value traces back to a specific database row or document chunk. |
| Test-validated | Every retrieval path has automated fixture validation. |

### Layer 4: Automated RAG Evaluation (RAGAS + pytest)
A CI/CD test suite grades the retrieval engine against thousands of synthetic queries. The following RAGAS metrics must clear the stated thresholds before any deployment:

| RAGAS Metric | Minimum Threshold | What It Measures |
| :--- | :--- | :--- |
| Context Precision | 0.90 | Are the retrieved chunks relevant to the query? |
| Context Recall | 0.85 | Are all necessary chunks retrieved? |
| Faithfulness | 0.95 | Does the generated answer stick to retrieved context only? |
| Answer Relevancy | 0.90 | Does the answer actually address the question? |

---

## 5. Lean Multi-Model Orchestration

We reject throwing heavy models at simple tasks. Each stage uses the leanest model that perfectly executes its narrow responsibility:

### A. The Classifier Router (Ultra-Light)
A sub-3B parameter model (`Qwen2.5-1.5B` or `Llama-3.2-3B`) fine-tuned exclusively for the 5-intent JSON schema. Runs in milliseconds. Negligible VRAM overhead.

### B. Query Transformation and Hybrid Search
The classified parameters query Qdrant using both dense semantic vectors (`bge-m3`, 1024 dimensions) and sparse exact-match vectors (`SPLADE`). Results from 3 to 5 query variations are merged using **Reciprocal Rank Fusion (RRF)**.

### C. Cross-Encoder Re-Ranking
The top 50 merged results pass through a non-generative cross-encoder (`bge-reranker-large`). It does not write text. It solely computes the mathematical relevance of each candidate against the original query.

### D. Corrective RAG (CRAG) Gate
If the reranker's top score remains below the confidence threshold, a deterministic evaluator intercepts the flow. Instead of risking a hallucinated draft, CRAG routes to either a web-search fallback or a clarification draft.

### E. The Drafter
A competent but lean model (`Qwen2.5-7B-Instruct` or `Mistral-NeMo-12B`) generates the final professional reply using only the retrieved data boundary. Zero access to raw database fields outside the isolated data packet.

---

## 6. Data Pipeline Specification

| Stage | Tool | Action |
| :--- | :--- | :--- |
| Ingest | Python loader / API connector | Read structured (Excel, CSV, SQL) and unstructured (PDF, DOCX) sources |
| Chunk | Recursive text splitter | Split documents into 512-token chunks with 64-token overlap |
| Embed | bge-m3 via Ollama (dense) + SPLADE (sparse) | Generate dual vector representations per chunk |
| Store | Qdrant (self-hosted) | Upsert with full payload metadata |
| Retrieve | Hybrid search + RRF | Dense + Sparse fusion across multi-query expansions |
| Rerank | bge-reranker-large | Cross-encoder precision scoring |
| Serve | n8n webhook or Python FastAPI | Return top-k context to the drafting LLM |
| Quality Gate | Great Expectations or custom validators | Schema, freshness, volume, uniqueness, referential checks |

---

## 7. OWASP LLM Top 10: Threat Model for the RAG Pipeline

| Threat | Risk Level | Mitigation |
| :--- | :--- | :--- |
| **Prompt Injection** (LLM01) | High | Input sanitization in Thread Stripper. System prompt isolation. Never concatenate user text directly into retrieval queries. |
| **Insecure Output Handling** (LLM02) | Medium | Scrub Format node strips all markdown, placeholders, and code fences before output. |
| **Training Data Poisoning** (LLM03) | Medium | Fine-tuning dataset is generated internally from verified fixtures. No external crowdsourced data. |
| **Sensitive Information Disclosure** (LLM06) | High | Data Packet Isolation firewall. Internal fields (discount rates, internal categories) are physically stripped before reaching the LLM. |
| **Excessive Agency** (LLM08) | Low | Draft-only posture. The LLM never sends emails, never writes to the database, never executes tools autonomously. |
| **Overreliance** (LLM09) | Medium | CRAG evaluator intercepts low-confidence results. Human-in-the-loop review of all drafts before sending. |

---

## 8. Test Strategy (Test Pyramid)

| Layer | Coverage Target | Scope |
| :--- | :--- | :--- |
| Unit Tests (70%) | Line coverage 80%+, Branch 75%+ | Pydantic schema validation, regex matchers, data packet composition, scrub logic |
| Integration Tests (20%) | All retrieval paths | End-to-end: Query -> Qdrant -> Rerank -> Data Packet -> Draft (mocked LLM) |
| Evaluation Tests (10%) | RAGAS thresholds above | Full pipeline accuracy against synthetic query corpus (1000+ queries) |

### Edge Case Matrix

| Category | Test Cases |
| :--- | :--- |
| Boundaries | Empty product name, single-character query, 500-character product name |
| Unicode | Italian accented characters, mixed-language queries, emoji in email body |
| Ambiguity | Two products with near-identical names, query matching multiple categories |
| Missing Data | Product exists but stock_status is null, delivery with no ETA |
| Adversarial | Prompt injection attempts in email body, SQL-like syntax in product names |

---

## 9. Data Classification and Compliance

| Classification | Examples | Handling |
| :--- | :--- | :--- |
| **Public** | Product names, categories | Stored in vector DB payload. No restrictions. |
| **Internal** | Stock quantities, arrival dates, unit prices | Passed to LLM only through the isolated data packet. Never logged in full. |
| **Confidential** | Customer names, order IDs, delivery addresses | Encrypted at rest. Accessible only during active pipeline execution. Purged from logs. |
| **Restricted** | OAuth tokens, API keys, Entra ID secrets | Environment variables only. Never stored in code, logs, or vector DB. |

Audit trail: Every pipeline execution emits a structured log entry containing timestamp, message ID, classified intent, route, match tier, confidence score, and processing status. No confidential field values are included in the log.

---

## 10. Target Repository Structure

```text
email-classifier/
  workflows/              n8n workflow JSONs (Cloud and Local variants)
  src/                    [NEW] Core ML Python packages
    rag/                  Advanced retriever (Hybrid, CRAG, Rerank)
    train/                Supervised Fine-Tuning scripts (MLX / Unsloth)
    eval/                 RAGAS evaluation and accuracy benchmarking
  data/                   Corpus files and Alpaca-format training JSONL
  docker/                 Container definitions for Qdrant, Ollama, n8n
  scripts/                Utilities and pipeline verifiers
  docs/                   Architecture documentation and diagrams
    adr/                  [NEW] Architecture Decision Records
  tests/                  [NEW] Unit, integration, and evaluation test suites
```

---

## 11. Schema Variables and Search Payload

| Schema Variable | Data Type | Source System | RAG Retrieval Purpose |
| :--- | :--- | :--- | :--- |
| `item_id` | String / UUID | ERP / DB | Exact sparse match anchor |
| `document_type` | Enum | Classification | Pre-filter metadata (`inventory`, `shipping_policy`, `warranty`) |
| `semantic_content` | String (Chunk) | Text splitter | Dense embedding payload for bge-m3 |
| `exact_keywords` | Array[String] | Tokenizer | Part numbers and SKUs for SPLADE sparse matching |
| `stock_status` | Enum | Live DB | Post-retrieval validation (In Stock vs Out of Stock) |
| `delivery_eta_hash` | String | Live DB | Cross-checked against recipient ID for authorized visibility |
| `chunk_index` | Integer | Chunker | Ordering reconstructor for multi-chunk documents |
| `source_file` | String | Ingest | Traceability back to the original document or spreadsheet |
