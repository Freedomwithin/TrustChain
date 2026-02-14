use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// Hardcoded Notary Public Key
pub const NOTARY_PUBKEY: Pubkey = pubkey!("Eg39fu7jw4ynYg3N3mzqusb1qLEZBH2ov62T564BFdYF");

#[program]
pub mod trustchain_notary {
    use super::*;

    pub fn update_integrity(ctx: Context<UpdateIntegrity>, gini_score: u16, hhi_score: u16, status: u8) -> Result<()> {
        // Verify signer is the Notary
        require_keys_eq!(ctx.accounts.notary.key(), NOTARY_PUBKEY, TrustChainError::UnauthorizedNotary);

        let user_integrity = &mut ctx.accounts.user_integrity;
        user_integrity.gini_score = gini_score;
        user_integrity.hhi_score = hhi_score;
        user_integrity.status = status;
        user_integrity.last_updated = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateIntegrity<'info> {
    #[account(
        init_if_needed,
        payer = notary,
        space = 8 + 2 + 2 + 1 + 8 + 64, // Added 64 bytes padding for future upgrades
        seeds = [b"config", user.key().as_ref()],
        bump
    )]
    pub user_integrity: Account<'info, UserIntegrity>,

    /// CHECK: The user address we are updating the score for.
    pub user: UncheckedAccount<'info>,

    #[account(mut)]
    pub notary: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct UserIntegrity {
    pub gini_score: u16,
    pub hhi_score: u16,
    pub status: u8,
    pub last_updated: i64,
}

#[error_code]
pub enum TrustChainError {
    #[msg("Signer is not the authorized Notary.")]
    UnauthorizedNotary,
}

#[account]
pub struct GlobalConfig {
    pub bump: u8,
}
