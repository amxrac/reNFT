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
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  KeypairSigner,
  createSignerFromKeypair,
  generateSigner,
  keypairIdentity,
  percentAmount,
  publicKey,
} from "@metaplex-foundation/umi";
import {
  createNft,
  findMasterEditionPda,
  findMetadataPda,
  mplTokenMetadata,
  verifySizedCollectionItem,
} from "@metaplex-foundation/mpl-token-metadata";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

describe("renft", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.renft as Program<Renft>;
  const connection = provider.connection;
  const umi = createUmi(connection);

  const admin = provider.wallet;
  const adminWallet = admin as NodeWallet;
  const creatorWallet = umi.eddsa.createKeypairFromSecretKey(
    new Uint8Array(adminWallet.payer.secretKey)
  );
  const creator = createSignerFromKeypair(umi, creatorWallet);
  umi.use(keypairIdentity(creator));
  umi.use(mplTokenMetadata());

  const daoAuthority = Keypair.generate();
  const buyer = Keypair.generate();

  const marketplaceName = "marketplaceName1";
  const marketplaceFee = 100;

  let marketplacePda: PublicKey;
  let treasuryPda: PublicKey;
  let rewardsMint: PublicKey;
  let whitelistedDaoPda: PublicKey;
  let listingPda: PublicKey;
  let vaultPda: PublicKey;
  let collectionMint: KeypairSigner;
  let nftMint: KeypairSigner;
  let daoAta: PublicKey;
  let buyerAta: PublicKey;

  before(async () => {
    const adminSig = await connection.requestAirdrop(
      admin.publicKey,
      2_000_000_000
    );
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature: adminSig,
      ...latestBlockhash,
    });

    const daoSig = await connection.requestAirdrop(
      daoAuthority.publicKey,
      2_000_000_000
    );
    await connection.confirmTransaction({
      signature: daoSig,
      ...latestBlockhash,
    });

    const buyerSig = await connection.requestAirdrop(
      buyer.publicKey,
      2_000_000_000
    );
    await connection.confirmTransaction({
      signature: buyerSig,
      ...latestBlockhash,
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    collectionMint = generateSigner(umi);

    await createNft(umi, {
      mint: collectionMint,
      name: "reNFT",
      symbol: "RN",
      uri: "http://images5.fanpop.com/image/photos/28000000/randomised-random-28065165-1024-819.jpg",
      sellerFeeBasisPoints: percentAmount(5.5),
      collectionDetails: { __kind: "V1", size: 10 },
    }).sendAndConfirm(umi);
    console.log(
      `collection NFT created: ${collectionMint.publicKey.toString()}`
    );

    nftMint = generateSigner(umi);

    await createNft(umi, {
      mint: nftMint,
      name: "reNFT",
      symbol: "RN",
      uri: "http://images5.fanpop.com/image/photos/28000000/randomised-random-28065165-1024-819.jpg",
      sellerFeeBasisPoints: percentAmount(5.5),
      collection: { verified: false, key: collectionMint.publicKey },
      tokenOwner: publicKey(daoAuthority.publicKey),
    }).sendAndConfirm(umi);
    console.log(`NFT created: ${collectionMint.publicKey.toString()}`);

    const collectionMetadata = findMetadataPda(umi, {
      mint: collectionMint.publicKey,
    });
    const collectionMasterEdition = findMasterEditionPda(umi, {
      mint: collectionMint.publicKey,
    });
    const nftMetadata = findMetadataPda(umi, { mint: nftMint.publicKey });
    await verifySizedCollectionItem(umi, {
      metadata: nftMetadata,
      collectionAuthority: creator,
      collectionMint: collectionMint.publicKey,
      collection: collectionMetadata,
      collectionMasterEditionAccount: collectionMasterEdition,
    }).sendAndConfirm(umi);
    console.log("collection NFT verified");

    daoAta = await getOrCreateAssociatedTokenAccount(
      connection,
      daoAuthority,
      new PublicKey(nftMint.publicKey),
      daoAuthority.publicKey
    ).then((addr) => addr.address);

    buyerAta = await getOrCreateAssociatedTokenAccount(
      connection,
      buyer,
      new PublicKey(nftMint.publicKey),
      buyer.publicKey
    ).then((addr) => addr.address);

    await mintTo(
      connection,
      daoAuthority,
      new PublicKey(nftMint.publicKey),
      daoAta,
      daoAuthority,
      1
    );

    marketplacePda = PublicKey.findProgramAddressSync(
      [Buffer.from("marketplace"), Buffer.from(marketplaceName)],
      program.programId
    )[0];

    treasuryPda = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), marketplacePda.toBuffer()],
      program.programId
    )[0];

    rewardsMint = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("rewards"), Buffer.from(marketplaceName)],
      program.programId
    )[0];

    whitelistedDaoPda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("whitelist"),
        marketplacePda.toBuffer(),
        new PublicKey(collectionMint.publicKey).toBuffer(),
      ],
      program.programId
    )[0];

    listingPda = PublicKey.findProgramAddressSync(
      [marketplacePda.toBuffer(), new PublicKey(nftMint.publicKey).toBuffer()],
      program.programId
    )[0];

    vaultPda = await anchor.utils.token.associatedAddress({
      mint: new PublicKey(nftMint.publicKey),
      owner: listingPda,
    });
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
            rewardMint: rewardsMint,
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
    it("creates an NFT listing", async () => {
      const nftMetadata = findMetadataPda(umi, { mint: nftMint.publicKey })[0];
      const nftEdition = findMasterEditionPda(umi, {
        mint: nftMint.publicKey,
      })[0];
      const price = new anchor.BN(1);
      const rentalDuration = new anchor.BN(86400);
      try {
        const sig = await program.methods
          .list(price, rentalDuration)
          .accountsPartial({
            seller: daoAuthority.publicKey,
            marketplace: marketplacePda,
            whitelistedDao: whitelistedDaoPda,
            listing: listingPda,
            mintAddress: nftMint.publicKey,
            sellerAta: daoAta,
            vault: vaultPda,
            collectionMint: collectionMint.publicKey,
            metadata: nftMetadata,
            masterEdition: nftEdition,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([daoAuthority])
          .rpc();
        const listingAccount = await program.account.listing.fetch(listingPda);
        expect(listingAccount.seller.toString()).to.equal(
          daoAuthority.toString()
        );
        expect(listingAccount.price.toString()).to.equal(price.toString());
        expect(listingAccount.rentalDuration.toString()).to.equal(
          rentalDuration.toString()
        );
        expect(listingAccount.currentRenter).to.be.null;
        expect(listingAccount.rentalStart).to.be.null;
        expect(listingAccount.rentalEnd).to.be.null;
        const vaultBalance = await connection.getTokenAccountBalance(vaultPda);
        expect(vaultBalance.value.amount).to.equal("1");
        const sellerAtaAccount =
          await provider.connection.getTokenAccountBalance(daoAta);
        expect(sellerAtaAccount.value.amount).to.equal("0");
      } catch (error: any) {
        console.error(`something went wrong: ${error}`);
        if (error.logs && Array.isArray(error.logs)) {
          console.log("Transaction Logs:");
          error.logs.forEach((log: string) => console.log(log));
        } else {
          console.log("No logs available in the error .");
        }
      }
    });
  });
});
