pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("HFCx3WdsfV1L8J2XHEGCMiK2kNArvrPDBLscB5vb1tij");

#[program]
pub mod renft {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, name: String, fee: u16) -> Result<()> {
        instructions::initialize::handler(ctx, name, fee)?;
        Ok(())
    }

    pub fn list(ctx: Context<List>, price: u64, rental_duration: i64) -> Result<()> {
        instructions::list::handler(ctx, price, rental_duration)
    }
}
