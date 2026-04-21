"""
matcher_reference.py

Python reference implementation of the Node 7 (Matcher) logic.
Uses rapidfuzz for scoring. Imports only standard library plus rapidfuzz.
"""

import json
import re
from typing import Optional

from rapidfuzz import fuzz, process


def normalize(text: str) -> str:
    """Lowercase and strip whitespace."""
    if not text:
        return ""
    return text.lower().strip()


def exact_match(query: str, products: list[dict]) -> Optional[dict]:
    """Tier 1: Exact normalized match on Product_Name."""
    nq = normalize(query)
    for product in products:
        if normalize(product.get("Product_Name", "")) == nq:
            return product
    return None


def substring_match(query: str, products: list[dict]) -> Optional[dict]:
    """Tier 2: Case-insensitive substring match."""
    nq = normalize(query)
    for product in products:
        name = normalize(product.get("Product_Name", ""))
        if nq in name or name in nq:
            return product
    return None


def fuzzy_match(query: str, products: list[dict], threshold: int = 75) -> Optional[dict]:
    """Optional fuzzy match using rapidfuzz token_sort_ratio."""
    names = [p.get("Product_Name", "") for p in products]
    if not names:
        return None
    result = process.extractOne(
        query, names, scorer=fuzz.token_sort_ratio, score_cutoff=threshold
    )
    if result:
        match_name, score, index = result
        return products[index]
    return None


def match_delivery(
    product_name: str,
    customer_name: str,
    deliveries: list[dict],
) -> Optional[dict]:
    """Match a delivery row on product plus customer."""
    np = normalize(product_name)
    nc = normalize(customer_name)
    for d in deliveries:
        dp = normalize(d.get("Product_Name", ""))
        dc = normalize(d.get("Customer_Name", ""))
        product_match = dp == np or np in dp or dp in np
        customer_match = not nc or dc == nc or nc in dc or dc in nc
        if product_match and customer_match:
            return d
    return None


def run_matcher(
    intent: str,
    product_name: Optional[str],
    customer_name: Optional[str],
    inventory: list[dict],
    deliveries: list[dict],
) -> dict:
    """
    Run the two-tier matching logic.

    Returns a dict with keys: route, matchedProduct, matchedDelivery, match_tier.
    """
    if not product_name:
        return {
            "route": "clarification_draft",
            "matchedProduct": None,
            "matchedDelivery": None,
            "match_tier": "none",
        }

    # Tier 1: Exact
    matched = exact_match(product_name, inventory)
    tier = "exact" if matched else None

    # Tier 2: Substring
    if not matched:
        matched = substring_match(product_name, inventory)
        tier = "substring" if matched else None

    if not matched:
        return {
            "route": "not_found_draft",
            "matchedProduct": None,
            "matchedDelivery": None,
            "match_tier": "none",
        }

    # For Delivery_Tracking, also match deliveries
    matched_delivery = None
    if intent == "Delivery_Tracking":
        matched_delivery = match_delivery(
            matched.get("Product_Name", ""),
            customer_name or "",
            deliveries,
        )
        if not matched_delivery:
            return {
                "route": "not_found_draft",
                "matchedProduct": matched,
                "matchedDelivery": None,
                "match_tier": tier,
            }

    return {
        "route": "high_confidence",
        "matchedProduct": matched,
        "matchedDelivery": matched_delivery,
        "match_tier": tier,
    }


if __name__ == "__main__":
    # Quick self-test
    test_inventory = [
        {"Product_ID": "PRD-001", "Product_Name": "TechPro Chair 350X"},
        {"Product_ID": "PRD-002", "Product_Name": "TechPro Workstation 532X"},
    ]
    test_deliveries = [
        {
            "Order_ID": "ORD-0001",
            "Customer_Name": "Umbrella Corp",
            "Product_Name": "TechPro Chair 350X",
            "Quantity": 10,
            "Delivery_ETA": "2026-05-13",
            "Status": "In Transit",
        },
    ]

    result = run_matcher(
        "Pricing_Request", "TechPro Chair 350X", None, test_inventory, test_deliveries
    )
    assert result["route"] == "high_confidence", f"Expected high_confidence, got {result['route']}"
    assert result["match_tier"] == "exact"
    print("Self-test passed.")
