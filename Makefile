.PHONY: build verify test test-scrub test-fixtures check-prompt-sync seed-rag clean

NODE ?= $(shell which node 2>/dev/null || echo /usr/local/bin/node)

build: verify
	@echo "Build complete. All validations passed."

verify: test check-prompt-sync
	@python3 -c "import json; json.load(open('workflows/cloud/workflow.json')); print('Cloud workflow JSON: VALID')"
	@python3 -c "import json; json.load(open('workflows/local/workflow.json')); print('Local workflow JSON: VALID')"
	@echo "All verifications passed."

test: test-scrub test-fixtures

test-scrub:
	@$(NODE) scripts/test_scrub.js

test-fixtures:
	@python3 scripts/validate_fixtures.py

check-prompt-sync:
	@python3 scripts/check_prompt_sync.py

seed-rag:
	@python3 scripts/seed_qdrant.py

clean:
	@rm -f .seed_cache.json
	@find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@echo "Clean complete."
