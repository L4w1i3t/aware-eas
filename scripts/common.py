"""
Common plotting utilities and consistent styling for policy visualizations.

This module centralizes color/marker/linestyle mappings and tie-handling logic
so all plotting scripts render consistently.
"""

from typing import Dict, List

# Consistent policy order (also used when resolving ties)
POLICY_ORDER: List[str] = [
    'LRU',
    'TTLOnly',
    'PriorityFresh',
    'PAFTinyLFU',
]

# Color scheme for policies
POLICY_COLORS: Dict[str, str] = {
    'LRU': '#3b82f6',          # blue
    'TTLOnly': '#f59e0b',      # amber
    'PriorityFresh': '#10b981',# green
    'PAFTinyLFU': '#8b5cf6',   # purple
}

# Shapes and linestyles for better distinction in line plots
POLICY_MARKERS: Dict[str, str] = {
    'LRU': 'o',
    'TTLOnly': 's',
    'PriorityFresh': '^',
    'PAFTinyLFU': 'D',
}

POLICY_LINESTYLES: Dict[str, str] = {
    'LRU': '-',
    'TTLOnly': '--',
    'PriorityFresh': '-.',
    'PAFTinyLFU': ':',
}


def abbreviate_policy(policy: str) -> str:
    """Return a short, human-friendly code for a policy name.

    LRU -> LRU, TTLOnly -> TTL, PriorityFresh -> PRI, PAFTinyLFU -> PAF.
    Falls back to first 3 uppercase letters for unknown policies.
    """
    if policy == 'LRU':
        return 'LRU'
    if policy == 'TTLOnly':
        return 'TTL'
    if policy == 'PriorityFresh':
        return 'PRI'
    if policy == 'PAFTinyLFU':
        return 'PAF'
    return policy[:3].upper()


def get_winner_label(values_dict: Dict[str, float], tolerance: float = 1e-9) -> str:
    """Determine winner(s) among policies, handling ties consistently.

    Args:
        values_dict: mapping of {policy_name: metric_value}
        tolerance: absolute difference regarded as a tie

    Returns:
        'ANY' when all tied, a single code like 'LRU', or multi like 'LRU/PAF'.
    """
    if not values_dict:
        return 'N/A'

    max_value = max(values_dict.values())
    winners = [p for p, v in values_dict.items() if abs(v - max_value) <= tolerance]

    if len(winners) == len(values_dict):
        return 'ANY'

    # Enforce stable order according to POLICY_ORDER, then abbreviate
    ordered = [w for w in POLICY_ORDER if w in winners]
    if len(ordered) == 1:
        return abbreviate_policy(ordered[0])
    return '/'.join(abbreviate_policy(w) for w in ordered)


def find_policy_by_abbrev(abbrev: str, available: List[str]) -> str:
    """Return the full policy name matching a 3-letter abbreviation.

    Performs exact mapping for known policies, otherwise falls back to a
    case-insensitive startswith match. Returns empty string if not found.
    """
    mapping = {
        'LRU': 'LRU',
        'TTL': 'TTLOnly',
        'PRI': 'PriorityFresh',
        'PAF': 'PAFTinyLFU',
    }
    target = mapping.get(abbrev.upper(), '')
    if target and target in available:
        return target
    # Fallback: case-insensitive startswith
    for p in available:
        if p.lower().startswith(abbrev.lower()):
            return p
    return ''
