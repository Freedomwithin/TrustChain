use cosmwasm_std::{
    entry_point, to_json_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdResult, Uint128,
};

use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, IntegrityResponse, QueryMsg};
use crate::state::{Config, PoolIntegrity, CONFIG, POOL_INTEGRITY, USER_LIQUIDITY};

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    let config = Config {
        oracle_pubkey: msg.oracle_pubkey,
    };
    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new().add_attribute("method", "instantiate"))
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::DepositLiquidity { pool_id, amount } => {
            execute_deposit_liquidity(deps, info, pool_id, amount)
        }
        ExecuteMsg::VerifyAttestation {
            wallet,
            tier,
            timestamp,
            signature,
        } => execute_verify_attestation(deps, env, wallet, tier, timestamp, signature),
    }
}

pub fn execute_deposit_liquidity(
    deps: DepsMut,
    info: MessageInfo,
    pool_id: String,
    amount: Uint128,
) -> Result<Response, ContractError> {
    let user = info.sender;
    let pool_key = pool_id.as_str();

    let old_user_bal = USER_LIQUIDITY
        .may_load(deps.storage, (pool_key, &user))?
        .unwrap_or_default();
    let new_user_bal = old_user_bal + amount;
    USER_LIQUIDITY.save(deps.storage, (pool_key, &user), &new_user_bal)?;

    let mut pool = POOL_INTEGRITY
        .may_load(deps.storage, pool_key)?
        .unwrap_or(PoolIntegrity {
            total_liquidity: Uint128::zero(),
            sum_squared_amounts: Uint128::zero(),
        });

    let old_sum_sq = pool.sum_squared_amounts;

    // Calculation: new_sum_sq = old_sum_sq - old_user_bal^2 + new_user_bal^2
    let old_bal_sq = old_user_bal.checked_mul(old_user_bal)
        .map_err(|_| ContractError::Std(cosmwasm_std::StdError::generic_err("Overflow calculating old balance square")))?;
    let new_bal_sq = new_user_bal.checked_mul(new_user_bal)
        .map_err(|_| ContractError::Std(cosmwasm_std::StdError::generic_err("Overflow calculating new balance square")))?;

    let new_sum_sq = old_sum_sq
        .checked_sub(old_bal_sq)
        .map_err(|_| ContractError::Std(cosmwasm_std::StdError::generic_err("Underflow calculating new sum squares")))?
        .checked_add(new_bal_sq)
        .map_err(|_| ContractError::Std(cosmwasm_std::StdError::generic_err("Overflow calculating new sum squares")))?;

    pool.sum_squared_amounts = new_sum_sq;
    pool.total_liquidity += amount;

    POOL_INTEGRITY.save(deps.storage, pool_key, &pool)?;

    Ok(Response::new()
        .add_attribute("method", "deposit_liquidity")
        .add_attribute("pool_id", pool_id)
        .add_attribute("new_total", pool.total_liquidity)
        .add_attribute("new_sum_sq", pool.sum_squared_amounts))
}

pub fn execute_verify_attestation(
    deps: DepsMut,
    env: Env,
    wallet: String,
    tier: u8,
    timestamp: u64,
    signature: Binary,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    // Reconstruct Message: "wallet:tier:timestamp"
    let message = format!("{}:{}:{}", wallet, tier, timestamp);
    let message_bytes = message.as_bytes();

    // Verify using Ed25519
    let verified = deps.api.ed25519_verify(message_bytes, signature.as_slice(), config.oracle_pubkey.as_slice())
        .map_err(|_| ContractError::InvalidSignature {})?;

    if !verified {
        return Err(ContractError::InvalidSignature {});
    }

    // Check Timestamp (replay protection / expiry)
    let current_time = env.block.time.seconds();
    if timestamp > current_time + 60 || timestamp < current_time.saturating_sub(300) {
         return Err(ContractError::Std(cosmwasm_std::StdError::generic_err("Attestation expired or future")));
    }

    Ok(Response::new()
        .add_attribute("method", "verify_attestation")
        .add_attribute("status", "valid")
        .add_attribute("tier", tier.to_string()))
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetIntegrity { pool_id } => to_json_binary(&query_integrity(deps, pool_id)?),
    }
}

fn query_integrity(deps: Deps, pool_id: String) -> StdResult<IntegrityResponse> {
    let pool = POOL_INTEGRITY
        .may_load(deps.storage, &pool_id)?
        .unwrap_or(PoolIntegrity {
            total_liquidity: Uint128::zero(),
            sum_squared_amounts: Uint128::zero(),
        });

    let hhi_score = if pool.total_liquidity.is_zero() {
        "0".to_string()
    } else {
        // HHI = sum_sq / total^2
        // We calculate score * 10000 for 4 decimal places
        let numerator = pool.sum_squared_amounts;
        let denominator_sq = pool.total_liquidity.checked_mul(pool.total_liquidity)
            .map_err(|_| cosmwasm_std::StdError::generic_err("Overflow calculating total liquidity squared"))?;

        let scaled_num = numerator.checked_mul(Uint128::from(10000u128))
             .map_err(|_| cosmwasm_std::StdError::generic_err("Overflow scaling numerator"))?;

        let score = scaled_num.checked_div(denominator_sq).unwrap_or(Uint128::zero());

        format!("0.{:04}", score)
    };

    Ok(IntegrityResponse {
        total_liquidity: pool.total_liquidity,
        hhi_score,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};
    use cosmwasm_std::{coins, from_json};

    #[test]
    fn proper_initialization() {
        let mut deps = mock_dependencies();

        let msg = InstantiateMsg { oracle_pubkey: Binary::from(b"mock_key") };
        let info = mock_info("creator", &coins(1000, "earth"));

        // we can just call .unwrap() to assert this was a success
        let res = instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert_eq!(0, res.messages.len());

        // it worked, let's query the state
        let res = query(deps.as_ref(), mock_env(), QueryMsg::GetIntegrity { pool_id: "pool1".to_string() }).unwrap();
        let value: IntegrityResponse = from_json(&res).unwrap();
        assert_eq!("0", value.hhi_score);
    }
}
