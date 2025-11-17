import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Renft } from "../target/types/renft";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { expect } from "chai";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  createMetadataAccountV3,
  CreateMetadataAccountV3InstructionAccounts,
  CreateMetadataAccountV3InstructionArgs,
  DataV2Args,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  createMasterEditionV3,
  CreateMasterEditionV3InstructionAccounts,
  CreateMasterEditionV3InstructionArgs,
  verifyCollection,
  VerifyCollectionInstructionAccounts,
  Collection,
} from "@metaplex-foundation/mpl-token-metadata";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { web3JsEddsa } from "@metaplex-foundation/umi-signer-web3js";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";
import {
  signerIdentity,
  publicKey, // Helper to convert string/PublicKey to Umi's format
} from "@metaplex-foundation/umi";

describe("renft", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.renft as Program<Renft>;
  const connection = provider.connection;

  const admin = provider.wallet;
  const daoAuthority = Keypair.generate();

  const marketplaceName = "marketplaceName1";
  const marketplaceFee = 100;

  let marketplacePda: PublicKey;
  let treasuryPda: PublicKey;
  let whitelistedDaoPda: PublicKey;
  let collectionMint: PublicKey;
  let listingPda: PublicKey;
  let vaultPda: PublicKey;
  let nftMint: PublicKey;
  let daoAta: PublicKey;
  let metadataPda: PublicKey;
  let masterEditionPda: PublicKey;

  before(async () => {
    const adminSig = await connection.requestAirdrop(
      admin.publicKey,
      2_000_000_000
    );
    await connection.confirmTransaction(adminSig);

    const daoSig = await connection.requestAirdrop(
      daoAuthority.publicKey,
      2_000_000_000
    );
    await connection.confirmTransaction(daoSig);

    await new Promise((resolve) => setTimeout(resolve, 500));

    collectionMint = await createMint(
      connection,
      admin.payer,
      admin.publicKey,
      admin.publicKey,
      0
    );

    nftMint = await createMint(
      connection,
      daoAuthority,
      daoAuthority.publicKey,
      null,
      0
    );

    daoAta = await getOrCreateAssociatedTokenAccount(
      connection,
      daoAuthority,
      nftMint,
      daoAuthority.publicKey
    ).then((addr) => addr.address);

    await mintTo(connection, daoAuthority, nftMint, daoAta, daoAuthority, 1);

    marketplacePda = PublicKey.findProgramAddressSync(
      [Buffer.from("marketplace"), Buffer.from(marketplaceName)],
      program.programId
    )[0];

    treasuryPda = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), marketplacePda.toBuffer()],
      program.programId
    )[0];

    whitelistedDaoPda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("whitelist"),
        marketplacePda.toBuffer(),
        collectionMint.toBuffer(),
      ],
      program.programId
    )[0];

    listingPda = PublicKey.findProgramAddressSync(
      [marketplacePda.toBuffer(), nftMint.toBuffer()],
      program.programId
    )[0];

    vaultPda = await getAssociatedTokenAddress(
      nftMint,
      listingPda,
      true,
      TOKEN_PROGRAM_ID
    )[0];

    metadataPda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID).toBuffer(),
        nftMint.toBuffer(),
      ],
      new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID)
    )[0];

    masterEditionPda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID).toBuffer(),
        nftMint.toBuffer(),
        Buffer.from("edition"),
      ],
      new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID)
    )[0];

    const collectionMetadataPda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID).toBuffer(),
        collectionMint.toBuffer(),
      ],
      new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID)
    )[0];

    const collectionMasterEditionPda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID).toBuffer(),
        collectionMint.toBuffer(),
        Buffer.from("edition"),
      ],
      new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID)
    )[0];
  });

  describe("Initialize Marketplace", () => {
    it("initializes a marketplace", async () => {
      try {
        const sig = await program.methods
          .initialize(marketplaceName, marketplaceFee)
          .accountsStrict({
            admin: admin.publicKey,
            marketplace: marketplacePda,
            treasury: treasuryPda,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
      } catch (error: any) {
        console.error(`something went wrong: ${error}`);
        if (error.logs && Array.isArray(error.logs)) {
          console.log("Transaction Logs:");
          error.logs.forEach((log: string) => console.log(log));
        } else {
          console.log("No logs available in the error .");
        }
      }

      const marketplaceAccount = await program.account.marketplace.fetch(
        marketplacePda
      );
      expect(marketplaceAccount.admin.toString()).to.equal(
        admin.publicKey.toString()
      );
      expect(marketplaceAccount.name).to.equal(marketplaceName);
      expect(marketplaceAccount.fee).to.equal(marketplaceFee);
    });
  });

  describe("Whitelists a DAO", () => {
    it("it whitelists a DAO", async () => {
      try {
        const sig = await program.methods
          .whitelistDao()
          .accountsStrict({
            admin: admin.publicKey,
            daoAuthority: daoAuthority.publicKey,
            marketplace: marketplacePda,
            whitelistedDao: whitelistedDaoPda,
            collectionMint: collectionMint,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      } catch (error: any) {
        console.error(`something went wrong: ${error}`);
        if (error.logs && Array.isArray(error.logs)) {
          console.log("Transaction Logs:");
          error.logs.forEach((log: string) => console.log(log));
        } else {
          console.log("No logs available in the error .");
        }
      }

      const whitelistDaoAccount = await program.account.whitelistedDao.fetch(
        whitelistedDaoPda
      );
      expect(whitelistDaoAccount.daoAuthority.toString()).to.equal(
        daoAuthority.publicKey.toString()
      );
      expect(whitelistDaoAccount.collectionMint.toString()).to.equal(
        collectionMint.toString()
      );
    });

    it("fails when unauthorized admin tries whitelist a DAO", async () => {
      const unauthorizedAdmin = Keypair.generate();
      try {
        const sig = await program.methods
          .whitelistDao()
          .accountsStrict({
            admin: unauthorizedAdmin.publicKey,
            daoAuthority: daoAuthority.publicKey,
            marketplace: marketplacePda,
            whitelistedDao: whitelistedDaoPda,
            collectionMint: collectionMint,
            systemProgram: SystemProgram.programId,
          })
          .signers([unauthorizedAdmin])
          .rpc();
        ("expected transaction to fail but it succeeded");
      } catch (error: any) {
        expect(error).to.exist;
      }
    });
  });

  describe("Create Listing", () => {
    // it("creates an NFT listing", async () => {
    //   const price = new anchor.BN(10_000_000);
    //   const rentalDuration = new anchor.BN(86400);
    //   try {
    //     const sig = await program.methods
    //       .list(price, rentalDuration)
    //       .accounts({
    //         seller: daoAuthority.publicKey,
    //         marketplace: marketplacePda,
    //         whitelistedDao: whitelistedDaoPda,
    //         listing: listingPda,
    //         mintAddress: nftMint,
    //         sellerAta: daoAta,
    //         vault: vaultPda,
    //         collectionMint: collectionMint,
    //         metadata: metadataPda,
    //         masterEdition: masterEditionPda,
    //         metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
    //         associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    //         systemProgram: SystemProgram.programId,
    //         tokenProgram: TOKEN_PROGRAM_ID,
    //       })
    //       .signers([daoAuthority])
    //       .rpc();
    //     const listingAccount = await program.account.listing.fetch(listingPda);
    //     expect(listingAccount.seller.toString()).to.equal(
    //       daoAuthority.toString()
    //     );
    //     expect(listingAccount.price.toString()).to.equal(price.toString());
    //     expect(listingAccount.rentalDuration.toString()).to.equal(
    //       rentalDuration.toString()
    //     );
    //     expect(listingAccount.currentRenter).to.be.null;
    //     expect(listingAccount.rentalStart).to.be.null;
    //     expect(listingAccount.rentalEnd).to.be.null;
    //     const vaultBalance = await connection.getTokenAccountBalance(vaultPda);
    //     expect(vaultBalance.value.amount).to.equal("1");
    //     const sellerAtaAccount =
    //       await provider.connection.getTokenAccountBalance(daoAta);
    //     expect(sellerAtaAccount.value.amount).to.equal("0");
    //   } catch (error: any) {
    //     console.error(`something went wrong: ${error}`);
    //     if (error.logs && Array.isArray(error.logs)) {
    //       console.log("Transaction Logs:");
    //       error.logs.forEach((log: string) => console.log(log));
    //     } else {
    //       console.log("No logs available in the error .");
    //     }
    //   }
    // });
  });
});
