use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
    program::Renft,
    state::{Marketplace, WhitelistedDao},
};

#[derive(Accounts)]
pub struct WhitelistDao<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: this should be the dao's keypair
    pub dao_authority: UncheckedAccount<'info>,
    #[account(
        seeds = [b"marketplace", marketplace.name.as_bytes()],
        bump,
        constraint = admin.key() == marketplace.admin.key()
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        init,
        payer = admin,
        seeds = [b"whitelist", marketplace.key().as_ref(), collection_mint.key().as_ref()],
        space = WhitelistedDao::DISCRIMINATOR.len() + WhitelistedDao::INIT_SPACE,
        bump
    )]
    pub whitelisted_dao: Account<'info, WhitelistedDao>,

    pub collection_mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
}

impl<'info> WhitelistDao<'info> {
    pub fn whitelist_dao(&mut self, bumps: &WhitelistDaoBumps) -> Result<()> {
        self.whitelisted_dao.set_inner(WhitelistedDao {
            dao_authority: self.dao_authority.key(),
            collection_mint: self.collection_mint.key(),
            bump: bumps.whitelisted_dao,
        });

        Ok(())
    }
}

pub fn handler(ctx: Context<WhitelistDao>) -> Result<()> {
    ctx.accounts.whitelist_dao(&ctx.bumps)?;

    Ok(())
}
