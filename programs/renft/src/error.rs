use anchor_lang::prelude::error_code;

#[error_code]
pub enum ReNFTError {
    #[msg("The dao list is full.")]
    DaoListFull,
    #[msg("The dao is already in the list.")]
    DaoAlreadyWhitelisted,
    #[msg("The collection is invalid.")]
    InvalidCollection,
    #[msg("Unauthorized Dao")]
    UnauthorizedSeller,
}
