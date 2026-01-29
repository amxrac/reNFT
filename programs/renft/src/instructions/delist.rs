use crate::error::ReNFTError;
use crate::state::{Listing, Marketplace, WhitelistedDao};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
        TransferChecked,
    },
};

#[derive(Accounts)]
pub struct Delist<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        seeds = [b"marketplace", marketplace.name.as_bytes()],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    pub collection_mint: InterfaceAccount<'info, Mint>,

    #[account(
        seeds = [b"whitelist", marketplace.key().as_ref(), collection_mint.key().as_ref()],
        bump = whitelisted_dao.bump,
        constraint = whitelisted_dao.dao_authority == seller.key() @ ReNFTError::UnauthorizedSeller,
    )]
    pub whitelisted_dao: Account<'info, WhitelistedDao>,

    #[account(
        mut,
        seeds = [marketplace.key().as_ref(), mint_address.key().as_ref()],
        bump = listing.bump,
        constraint = listing.seller == seller.key(),
        close = seller,
    )]
    pub listing: Account<'info, Listing>,

    pub mint_address: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint_address,
        associated_token::authority = seller,
    )]
    pub seller_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_address,
        associated_token::authority = listing,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> Delist<'info> {
    pub fn delist(&mut self) -> Result<()> {
        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            to: self.seller_ata.to_account_info(),
            mint: self.mint_address.to_account_info(),
            authority: self.listing.to_account_info(),
        };

        let signer_seeds: &[&[&[u8]]] = &[&[
            &self.marketplace.key().to_bytes(),
            &self.mint_address.key().to_bytes(),
            &[self.listing.bump],
        ]];

        let cpi_cxt = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        transfer_checked(cpi_cxt, self.vault.amount, self.mint_address.decimals)?;

        Ok(())
    }

    pub fn close_valult(&mut self) -> Result<()> {
        let signer_seeds: &[&[&[u8]]] = &[&[
            &self.marketplace.key().to_bytes(),
            &self.mint_address.key().to_bytes(),
            &[self.listing.bump],
        ]];

        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = CloseAccount {
            account: self.vault.to_account_info(),
            destination: self.seller.to_account_info(),
            authority: self.listing.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        close_account(cpi_ctx)?;

        Ok(())
    }
}

pub fn handler(ctx: Context<Delist>) -> Result<()> {
    ctx.accounts.delist()?;
    ctx.accounts.close_valult()?;

    Ok(())
}
