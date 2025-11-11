use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub seller: Pubkey,
    pub mint_address: Pubkey,
    pub price: u64,
    pub bump: u8,
    pub rental_duration: i64,
    pub rental_start: Option<i64>,
    pub rental_end: Option<i64>,
    pub current_renter: Option<Pubkey>,
}
