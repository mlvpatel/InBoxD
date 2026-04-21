"""
check_prompt_sync.py

Reads the two prompt markdown files and verifies that key fragments
appear inside the corresponding LLM node parameters of both workflow
JSON files. Supports both n8n prompt styles: `messages.messageValues`
(local/Ollama) and `promptType` + `text` (cloud/OpenAI).
"""

import json
import os
import sys


def load_workflow(path: str) -> dict:
    with open(path, "r") as f:
        return json.load(f)


def extract_all_prompt_text(workflow: dict) -> str:
    """Extract all LLM prompt text from a workflow regardless of node style."""
    texts = []
    for node in workflow.get("nodes", []):
        params = node.get("parameters", {})
        # Style 1: promptType + text (cloud / OpenAI chat model)
        if "text" in params:
            texts.append(params["text"])
        # Style 2: messages.messageValues (local / Ollama)
        msg_values = params.get("messages", {}).get("messageValues", [])
        for msg in msg_values:
            if msg.get("message"):
                texts.append(msg["message"])
    return " ".join(texts)


STAGE1_FRAGMENTS = [
    "Availability_Status",
    "Quantity_Inquiry",
    "Incoming_Stock",
    "Pricing_Request",
    "Delivery_Tracking",
    "email classification assistant",
    "confidence",
]

STAGE2_FRAGMENTS = [
    "high_confidence",
    "not_found_draft",
    "clarification_draft",
    "email drafting assistant",
    "EUR",
]


def main():
    base = os.path.join(os.path.dirname(__file__), "..")
    cloud_path = os.path.join(base, "workflows", "cloud", "workflow.json")
    local_path = os.path.join(base, "workflows", "local", "workflow.json")

    cloud_wf = load_workflow(cloud_path)
    local_wf = load_workflow(local_path)

    passed = 0
    failed = 0

    for wf_name, wf in [("cloud", cloud_wf), ("local", local_wf)]:
        all_text = extract_all_prompt_text(wf)

        for frag in STAGE1_FRAGMENTS:
            if frag in all_text:
                passed += 1
            else:
                failed += 1
                print(f"FAIL [{wf_name}]: Stage 1 fragment missing: '{frag}'")

        for frag in STAGE2_FRAGMENTS:
            if frag in all_text:
                passed += 1
            else:
                failed += 1
                print(f"FAIL [{wf_name}]: Stage 2 fragment missing: '{frag}'")

    print(f"\nResults: {passed} passed, {failed} failed, {passed + failed} total")
    if failed > 0:
        sys.exit(1)
    else:
        print("All prompt sync checks passed.")


if __name__ == "__main__":
    main()
