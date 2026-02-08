use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use cosmwasm_std::{Binary, Uint128};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub oracle_pubkey: Binary, // Base64 expected
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    DepositLiquidity { pool_id: String, amount: Uint128 },
    VerifyAttestation {
        wallet: String,
        tier: u8,
        timestamp: u64,
        signature: Binary, // Base64 expected
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    GetIntegrity { pool_id: String },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct IntegrityResponse {
    pub total_liquidity: Uint128,
    pub hhi_score: String,
}
