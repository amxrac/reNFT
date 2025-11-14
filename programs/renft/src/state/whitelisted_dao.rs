use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct WhitelistedDao {
    pub dao_authority: Pubkey,
    pub collection_mint: Pubkey,
    pub bump: u8,
}
