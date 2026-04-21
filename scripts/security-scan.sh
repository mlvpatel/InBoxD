#!/bin/bash
# Universal Security Pre-Flight Scan (v1.0)
# Automated scan to run via pre-commit or GitHub Actions CI.

echo "🛡️  PRE-FLIGHT SECURITY SCAN"
echo "Starting scan..."
echo ""

CRITICAL_FOUND=0
WARNING_FOUND=0

# LAYER 1: SECRETS
echo "Layer 1 — Secrets:"
if grep -rniE "(api[_-]?key|secret|password|token|bearer|private[_-]?key)\s*[:=]\s*['\"][a-z0-9]{16,}" --exclude-dir=.git --exclude-dir=node_modules --exclude="*.example" .; then
    echo "🔴 BLOCKED — Secrets detected!"
    CRITICAL_FOUND=$((CRITICAL_FOUND + 1))
else
    echo "✅ CLEAN"
fi

# LAYER 2: PII / CLIENT DATA
echo "Layer 2 — PII / Client Data:"
pii_found=$(find . -name "*.xlsx" -o -name "*.xls" -o -name "*.csv" -o -name "*.pdf" -not -path "./.git/*" -not -path "./node_modules/*")
if [ -n "$pii_found" ]; then
    # In CI context we only flag if they are outside of expected test data folders, 
    # but for this strict repo we'll just check if they are tracked.
    echo "🟡 WARNING — Found potential client data files (ensure they are fixtures only):"
    echo "$pii_found"
    WARNING_FOUND=$((WARNING_FOUND + 1))
else
    echo "✅ CLEAN"
fi

# LAYER 3: SENSITIVE FILES
echo "Layer 3 — Sensitive Files:"
sensitive_found=""
for pattern in ".env" "*.key" "*.pem" "*.p12" "*.keystore" "id_rsa" "*.tfstate" "*.tfvars" "credentials.json" "service-account*.json"; do
  found=$(find . -name "$pattern" -not -path "./.git/*" -not -name "*.example" -not -name "*.template" 2>/dev/null)
  if [ -n "$found" ]; then
      sensitive_found="$sensitive_found $found"
  fi
done

if [ -n "$sensitive_found" ]; then
    echo "🔴 BLOCKED — Sensitive files found: $sensitive_found"
    CRITICAL_FOUND=$((CRITICAL_FOUND + 1))
else
    echo "✅ CLEAN"
fi

# LAYER 5: PROMPT INJECTION
echo "Layer 5 — Prompt Injection:"
missing_guards=""
for f in $(find . -name "*.json" -path "*workflow*" -o -name "extractor*.md" -o -name "*prompt*.md" 2>/dev/null); do
  if ! grep -l -i "untrusted_input\|never follow instructions\|ignore previous\|do not follow instructions" "$f" >/dev/null; then
    missing_guards="$missing_guards $f"
  fi
done

if [ -n "$missing_guards" ]; then
    echo "🟡 WARNING — Missing injection guards in:$missing_guards"
    WARNING_FOUND=$((WARNING_FOUND + 1))
else
    echo "✅ CLEAN — Guards present"
fi

# LAYER 6: INFRASTRUCTURE EXPOSURE
echo "Layer 6 — Infrastructure Exposure:"
if grep -rniE "(admin|root|password)\s*[:=]\s*['\"](admin|root|password|123|changeme)['\"]" --exclude-dir=.git --exclude="*.example" .; then
    echo "🔴 BLOCKED — Default credentials found!"
    CRITICAL_FOUND=$((CRITICAL_FOUND + 1))
else
    echo "✅ CLEAN"
fi

# LAYER 7: DEV ARTIFACTS
echo "Layer 7 — Dev Artifacts:"
artifacts_found=""
for pattern in ".venv/" "node_modules/" "__pycache__/" "*.pyc" "*.log" ".DS_Store" "Thumbs.db" "__MACOSX/" ".vscode/" ".idea/" "dist/" "build/" "target/" "*.egg-info/" "coverage/"; do
  found=$(find . -name "$pattern" -not -path "./.git/*" 2>/dev/null | head -3)
  if [ -n "$found" ]; then
      artifacts_found="$artifacts_found $found"
  fi
done

if [ -n "$artifacts_found" ]; then
    echo "🟡 WARNING — Dev artifacts found (should be in .gitignore): $artifacts_found"
    WARNING_FOUND=$((WARNING_FOUND + 1))
else
    echo "✅ CLEAN"
fi

# LAYER 8: SUBMISSION LANGUAGE
echo "Layer 8 — Submission Language:"
L8_OUTPUT=$(grep -rniE "interview|assessment|skills\.assessment|brief\b|reviewer\.will|impress|submission|candidate|hire\b|recruiter|evaluation|grading|passing\.score" --include="*.md" --include="*.json" --exclude-dir=.git . || true)

if [ -f ".security-exemptions" ]; then
    L8_OUTPUT=$(echo "$L8_OUTPUT" | grep -vFf .security-exemptions)
fi

if [ -n "$L8_OUTPUT" ]; then
    echo "🔴 BLOCKED — Submission-style language found!"
    echo "$L8_OUTPUT"
    CRITICAL_FOUND=$((CRITICAL_FOUND + 1))
else
    echo "✅ CLEAN"
fi

echo "═══════════════════════════════════"
if [ $CRITICAL_FOUND -gt 0 ]; then
    echo "RESULT: ❌ DO NOT PUSH"
    echo "Critical issues: $CRITICAL_FOUND"
    echo "Warnings: $WARNING_FOUND"
    exit 1
else
    echo "RESULT: ✅ READY TO PUSH"
    echo "Critical issues: 0"
    echo "Warnings: $WARNING_FOUND"
    exit 0
fi
echo "═══════════════════════════════════"
