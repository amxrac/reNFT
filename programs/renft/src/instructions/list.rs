use crate::state::{Listing, Marketplace};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{MasterEditionAccount, Metadata, MetadataAccount},
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

#[derive(Accounts)]
pub struct List<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        seeds = [b"marketplace", marketplace.name.as_bytes()],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        init,
        payer = seller,
        seeds = [marketplace.key().as_ref(), mint_address.key().as_ref()],
        bump,
        space = Listing::DISCRIMINATOR  .len() + Listing::INIT_SPACE
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
        init,
        payer = seller,
        associated_token::mint = mint_address,
        associated_token::authority = listing,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub collection_mint: InterfaceAccount<'info, Mint>,

    #[account(
        seeds = [
            b"metadata",
            metadata_program.key().as_ref(),
            mint_address.key().as_ref(),
        ],
        seeds::program = metadata_program.key(),
        bump,
        constraint = metadata.collection.as_ref().unwrap().key.as_ref() == collection_mint.key().as_ref(),
        constraint = metadata.collection.as_ref().unwrap().verified,
    )]
    pub metadata: Account<'info, MetadataAccount>,

    #[account(
        seeds = [
            b"metadata",
            metadata_program.key().as_ref(),
            mint_address.key().as_ref(),
            b"edition"
        ],
        seeds::program = metadata_program.key(),
        bump,
    )]
    pub master_edition: Account<'info, MasterEditionAccount>,

    pub metadata_program: Program<'info, Metadata>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> List<'info> {
    pub fn create_listing(
        &mut self,
        price: u64,
        bumps: &ListBumps,
        rental_duration: i64,
        rental_start: Option<i64>,
        rental_end: Option<i64>,
        current_renter: Option<Pubkey>,
    ) -> Result<()> {
        self.listing.set_inner(Listing {
            seller: self.seller.key(),
            mint_address: self.mint_address.key(),
            price,
            bump: bumps.listing,
            rental_duration,
            rental_start,
            rental_end,
            current_renter,
        });

        Ok(())
    }

    pub fn deposit_nft(&mut self) -> Result<()> {
        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = TransferChecked {
            from: self.seller_ata.to_account_info(),
            to: self.vault.to_account_info(),
            mint: self.mint_address.to_account_info(),
            authority: self.seller.to_account_info(),
        };

        let cpi_cxt = CpiContext::new(cpi_program, cpi_accounts);

        transfer_checked(cpi_cxt, self.seller_ata.amount, self.mint_address.decimals)?;

        Ok(())
    }
}

pub fn handler(ctx: Context<List>, price: u64, rental_duration: i64) -> Result<()> {
    ctx.accounts
        .create_listing(price, &ctx.bumps, rental_duration, None, None, None)?;

    ctx.accounts.deposit_nft()?;

    Ok(())
}

// add kini for admin to whiltelist dao/seller in initialize
