# FairScale API Documentation (Reconstructed)

**Note:** This documentation is reconstructed from the project context and `README.md` as the original source (`https://docs.fairscale.xyz/`) was inaccessible during the environment setup.

## Overview

FairScale provides a reputation tiering system for wallet addresses, allowing protocols to assess the long-term behavior and fairness of liquidity providers and traders.

## Endpoints

### Get Wallet Reputation

Retrieves the reputation tier and score for a specific wallet address.

- **URL:** `https://api.fairscale.xyz/v1/reputation/:address` (Hypothetical endpoint)
- **Method:** `GET`
- **Params:**
  - `address`: The Solana wallet address (Base58 encoded).

#### Response

```json
{
  "address": "WalletAddressHere",
  "tier": 3,
  "score": 85,
  "lastUpdated": "2023-10-27T10:00:00Z"
}
```

- `tier`: Integer (1-5). Higher is better.
  - Tier 1: New / Low Reputation (High Risk)
  - Tier 2: Probationary
  - Tier 3: Verified / Trusted
  - Tier 4: High Reputation
  - Tier 5: Elite
- `score`: Integer (0-100). Granular reputation score.

## Integration Logic

TrustChain integrates FairScale with its internal Gini coefficient analysis to determine eligibility for rewards and protected swaps.

### Logic Flow

1.  **Query FairScale API** to get the `tier`.
2.  **Calculate Gini Coefficient** locally or via TrustChain backend (`/api/verify`).
3.  **Apply Gatekeeper Logic**:

```javascript
const GINI_THRESHOLD = 0.5; // TrustChain Probationary Threshold
const FAIRSCALE_TIER_THRESHOLD = 2; // Minimum Tier required

if (giniScore >= GINI_THRESHOLD || fairScoreTier < FAIRSCALE_TIER_THRESHOLD) {
    return "BLOCKED";
}
return "ALLOWED";
```

### Pseudocode Reference

From `README.md`:

```python
async def check_lp_eligibility(wallet_address, wallet_trades):
    fairscore_tier = await fairscale_api(wallet_address)
    gini_score = calculate_gini_coefficient(wallet_trades)

    if gini_score > 0.3 or fairscore_tier < 2:
        return "SYBIL_BLOCKED - Ineligible for LP rewards"
    return "LP_REWARD_ELIGIBLE - Fair provider verified"
```

## Environment Variables

Ensure the following are configured in your environment:

- `FAIRSCALE_API_KEY`: API Key for accessing FairScale services (if required).
- `FAIRSCALE_API_URL`: Base URL for the API (default: `https://api.fairscale.xyz`).
