# RAG Design
last_updated: 2026-04-21

This document describes the retrieval augmented generation design used in the Email Classifier, covering the matching ladder, anti-hallucination rationale, embedding model selection, and scaling considerations.

## Overview

The Email Classifier uses a tiered matching ladder to resolve product names extracted by the Stage 1 LLM against the inventory database. The design prioritizes precision over recall: a false positive match (returning wrong product data) is far worse than a false negative (asking for clarification). This principle drives every design decision in the retrieval pipeline.

## The Matching Ladder

The matcher applies tiers in strict order, stopping at the first successful match.

### Tier 1: Exact Normalized Match

1. Normalize both the query product name and each database product name by converting to lowercase and stripping whitespace.
2. Compare for strict equality.
3. If a match is found, return the product with route "high_confidence" and match_tier "exact".

This tier handles the common case where the LLM extracts the product name exactly as it appears in the database. In production testing, approximately 70 to 80 percent of queries resolve at this tier.

### Tier 2: Case-Insensitive Substring Match

1. Check if the normalized query is contained within a normalized product name, or vice versa.
2. This handles partial product names (e.g., "ErgoLine" matching "ErgoLine Chair 928X") and minor variations.
3. If a match is found, return the product with route "high_confidence" and match_tier "substring".

The bidirectional substring check is intentional: it catches both abbreviated queries ("Laptop 303X" matching "TechPro Laptop 303X") and overly specific queries.

### Tier 3: Embedding Similarity (Local Variant Only)

This tier is available only in the local workflow variant and requires Qdrant and Ollama to be running.

1. Encode the query product name using the bge-m3 embedding model via the Ollama API.
2. Search the Qdrant `inventory_products` collection with the query vector.
3. Accept the top result only if both conditions are met:
   1. The cosine similarity score is at or above 0.82.
   2. The gap between the top result score and the second result score is at or above 0.05.
4. If accepted, return the product with route "high_confidence" and match_tier "embedding".

The dual-threshold approach (absolute score plus gap) prevents ambiguous matches. A high score alone is insufficient because two similar products might both score above the threshold. The gap requirement ensures the top result is meaningfully more similar than alternatives.

### Fallback: Not Found

If no tier produces a match, the matcher returns route "not_found_draft" with match_tier "none". The Stage 2 LLM then drafts a polite reply explaining that the product was not found in the current catalog.

## Anti-Hallucination Rationale

The separation between retrieval and generation is the primary anti-hallucination control. Four layers enforce data integrity.

1. **Data Packet Isolation**: The Compose Data Packet node constructs a minimal JSON object containing only the database fields relevant to the classified intent. The Stage 2 LLM receives this data packet and is instructed to cite only values present in it. Internal fields such as discount rates and product categories are physically stripped at this boundary and never reach the LLM.

2. **Prompt Constraint**: The Stage 2 system prompt contains the explicit rule: "You must NEVER cite a value that is not present in the data object." This is reinforced with "This is a hard rule with no exceptions."

3. **Empty Data Packets**: For "not_found_draft" and "clarification_draft" routes, the data packet is an empty object. The LLM cannot hallucinate data values because none are provided.

4. **Post-Generation Scrubbing**: The Scrub Format node uses regex patterns to detect and remove any residual template placeholders (e.g., [Your Name], {{variable}}), markdown formatting, and smart punctuation that the LLM may have injected despite prompt constraints.

## Embedding Model Selection

### Why bge-m3

The bge-m3 model was selected for the embedding tier based on the following criteria.

| Criterion | bge-m3 | Alternative (all-MiniLM-L6-v2) | Alternative (e5-mistral-7b) |
|---|---|---|---|
| Dimension | 1024 | 384 | 4096 |
| Multilingual | Yes (100+ languages) | Limited | Yes |
| Retrieval Quality (MTEB) | Top tier | Mid tier | Top tier |
| Inference Size | ~1.3 GB | ~80 MB | ~14 GB |
| Ollama Availability | Yes | No (requires custom setup) | Yes |
| Suitable for 7B host | Yes | Yes | No (too heavy to colocate) |

Key factors in the selection:

1. **Multilingual Support**: The system processes emails in both Italian and English. bge-m3 provides strong cross-lingual retrieval, meaning an Italian product name query can match an English product name in the database.

2. **Retrieval Quality**: For a database with similar product names (e.g., "ErgoLine Chair 928X" vs "ErgoLine Chair 926X"), high-quality embeddings are essential to distinguish between close matches.

3. **Ollama Integration**: bge-m3 is available as a native Ollama model, simplifying the deployment pipeline.

4. **Resource Efficiency**: At 1.3 GB, bge-m3 can run alongside the 7B inference model without exceeding the 24 GB unified memory minimum for Apple Silicon systems.

## Qdrant Collection Schema

```json
{
  "collection_name": "inventory_products",
  "vectors": {
    "size": 1024,
    "distance": "Cosine"
  }
}
```

Each point payload contains:

| Field | Type | Description |
|---|---|---|
| product_id | string | PRD-NNN format identifier |
| product_name | string | Full product name |
| category | string | Product category |
| unit_price | float | Price in EUR |
| discount_pct | float | Discount percentage (0 to 1) |
| stock_quantity | integer | Current stock count |
| stock_status | string | "In Stock" or "Out of Stock" |
| next_arrival_date | string or null | ISO 8601 date or null |

## Idempotent Seeding

The `seed_qdrant.py` script implements idempotent seeding.

1. Each product row is hashed using SHA-256 on its JSON-serialized content.
2. A local cache file (`.seed_cache.json`) stores the mapping from product_id to row hash.
3. On each run, the script compares the current row hash against the cached hash.
4. Only rows whose hash has changed (or are new) are re-embedded and upserted.
5. Point IDs are derived deterministically from the product_id using MD5 hashing, ensuring the same product always maps to the same Qdrant point ID.

## Threshold Tuning

The default thresholds (score >= 0.82, gap >= 0.05) were selected based on the following considerations.

1. **Score Threshold (0.82)**: Product names in the database follow a consistent pattern (Brand + Type + Number + "X"). Cosine similarity between genuinely matching products and their common misspellings or abbreviations typically falls in the 0.85 to 0.95 range. Setting the threshold at 0.82 provides a safety margin for edge cases while excluding unrelated products (which typically score below 0.75).

2. **Gap Threshold (0.05)**: Products within the same brand and type family (e.g., "ErgoLine Chair 928X" and "ErgoLine Chair 926X") may have cosine similarities that differ by only 0.02 to 0.04. Requiring a gap of 0.05 prevents the system from confidently matching the wrong product in a closely related product family.

These thresholds can be adjusted via the QDRANT_SCORE_THRESHOLD and QDRANT_GAP_THRESHOLD environment variables.

## Scaling Considerations

The current architecture (Tier 1 + 2 deterministic, Tier 3 dense vector) is effective for catalogs under 50,000 rows. For larger deployments, the following upgrades are documented in the [Implementation Plan](implementation_plan.md):

1. **Hybrid Search (Dense + Sparse)**: Adding sparse vectors (SPLADE or BM25) to complement dense bge-m3 embeddings. This prevents semantic collisions for part numbers and SKUs that look similar in embedding space but are functionally distinct.

2. **Cross-Encoder Reranking**: Passing the top 50 hybrid results through a cross-encoder model for precision scoring, dramatically reducing false positive matches.

3. **Corrective RAG (CRAG)**: Adding a deterministic evaluator between retrieval and generation that routes low-confidence matches to clarification rather than risking hallucinated responses.
