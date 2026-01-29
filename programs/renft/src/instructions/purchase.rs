use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

use anchor_spl::{
    associated_token::AssociatedToken,
    token_2022::transfer_checked,
    token_interface::{
        close_account, CloseAccount, Mint, TokenAccount, TokenInterface, TransferChecked,
    },
};

use crate::error::ReNFTError;
use crate::{Listing, Marketplace, WhitelistedDao};

#[derive(Accounts)]
pub struct Purchase<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        seeds = [b"marketplace", marketplace.name.as_str().as_bytes()],
        bump
    )]
    pub marketplace: Account<'info, Marketplace>,

    pub collection_mint: InterfaceAccount<'info, Mint>,

    #[account(
        seeds = [b"whitelist", marketplace.key().as_ref(), collection_mint.key().as_ref()],
        bump = whitelisted_dao.bump,
        constraint = whitelisted_dao.dao_authority == seller.key() @ ReNFTError::UnauthorizedSeller,
    )]
    pub whitelisted_dao: Account<'info, WhitelistedDao>,

    #[account(mut)]
    pub seller: SystemAccount<'info>,

    pub mint_address: InterfaceAccount<'info, Mint>,

    #[account(
        seeds = [marketplace.key().as_ref(), mint_address.key().as_ref()],
        bump = listing.bump,
        constraint = listing.seller == seller.key(),
    )]
    pub listing: Account<'info, Listing>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint_address,
        associated_token::authority = buyer
    )]
    pub buyer_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"treasury", marketplace.key().as_ref()],
        bump
    )]
    pub treasury: SystemAccount<'info>,

    #[account(
        mut,
        associated_token::mint = mint_address,
        associated_token::authority = listing
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> Purchase<'info> {
    pub fn transfer_sol(&mut self) -> Result<()> {
        let cpi_program = self.system_program.to_account_info();

        let cpi_accounts = Transfer {
            from: self.buyer.to_account_info(),
            to: self.seller.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(cpi_program.clone(), cpi_accounts);

        let fee = self.marketplace.fee as u64;
        let amount = self.listing.price.checked_sub(fee).unwrap();

        transfer(cpi_ctx, amount)?;

        let cpi_accounts = Transfer {
            from: self.buyer.to_account_info(),
            to: self.treasury.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer(cpi_ctx, fee)?;
        Ok(())
    }

    pub fn transfer_nft(&mut self) -> Result<()> {
        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            to: self.buyer_ata.to_account_info(),
            authority: self.listing.to_account_info(),
            mint: self.mint_address.to_account_info(),
        };

        let seeds = &[
            &self.marketplace.key().to_bytes()[..],
            &self.mint_address.key().to_bytes()[..],
            &[self.listing.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        transfer_checked(ctx, 1, 0)?;

        Ok(())
    }

    pub fn close_vault(&mut self) -> Result<()> {
        let seeds = &[
            &self.marketplace.key().to_bytes()[..],
            &self.mint_address.key().to_bytes()[..],
            &[self.listing.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = CloseAccount {
            account: self.vault.to_account_info(),
            authority: self.listing.to_account_info(),
            destination: self.seller.to_account_info(),
        };

        let ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );

        close_account(ctx)?;

        Ok(())
    }
}

pub fn handler(ctx: Context<Purchase>) -> Result<()> {
    ctx.accounts.transfer_sol()?;
    ctx.accounts.transfer_nft()?;
    ctx.accounts.close_vault()?;

    Ok(())
}
