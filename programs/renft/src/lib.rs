pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("HY4vmyrm8GooLHLdfo5T8fPuNM7yNDbWNW2emToBCW3F");

#[program]
pub mod renft {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, name: String, fee: u16) -> Result<()> {
        instructions::initialize::handler(ctx, name, fee)?;
        Ok(())
    }

    pub fn whitelist_dao(ctx: Context<WhitelistDao>) -> Result<()> {
        instructions::whitelist_dao::handler(ctx)
    }

    pub fn list(ctx: Context<List>, price: u64, rental_duration: i64) -> Result<()> {
        instructions::list::handler(ctx, price, rental_duration)
    }
}
