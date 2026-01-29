use anchor_lang::prelude::*;
use anchor_spl::{token::Token, token_interface::Mint};

use crate::state::Marketplace;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        seeds = [b"marketplace", name.as_bytes()],
        bump,
        space = Marketplace::DISCRIMINATOR.len() + Marketplace::INIT_SPACE,
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        seeds = [b"treasury", marketplace.key().as_ref()],
        bump,
    )]
    pub treasury: SystemAccount<'info>,

    #[account(
        init,
        payer = admin,
        seeds = [b"reward", marketplace.key().as_ref()],
        bump,
        mint::decimals = 6,
        mint::authority = admin,
    )]
    pub reward_mint: InterfaceAccount<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(&mut self, name: String, fee: u16, bumps: &InitializeBumps) -> Result<()> {
        self.marketplace.set_inner(Marketplace {
            admin: self.admin.key(),
            fee,
            bump: bumps.marketplace,
            treasury_bump: bumps.treasury,
            rewards_bump: bumps.reward_mint,
            name,
        });

        Ok(())
    }
}

pub fn handler(ctx: Context<Initialize>, name: String, fee: u16) -> Result<()> {
    ctx.accounts.initialize(name, fee, &ctx.bumps)?;

    Ok(())
}
