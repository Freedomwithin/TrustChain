use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use cosmwasm_std::{Addr, Binary, Uint128};
use cw_storage_plus::{Item, Map};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    pub oracle_pubkey: Binary, // Stored as Base64/Binary
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct PoolIntegrity {
    pub total_liquidity: Uint128,
    pub sum_squared_amounts: Uint128,
}

pub const CONFIG: Item<Config> = Item::new("config");
pub const POOL_INTEGRITY: Map<&str, PoolIntegrity> = Map::new("pool_integrity");
pub const USER_LIQUIDITY: Map<(&str, &Addr), Uint128> = Map::new("user_liquidity");
