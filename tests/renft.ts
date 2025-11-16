import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Renft } from "../target/types/renft";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("renft", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.renft as Program<Renft>;
  const connection = provider.connection;

  const admin = provider.wallet;
  const daoOne = Keypair.generate();

  const marketplaceName = "marketplaceName1";
  const marketplaceFee = 100;

  let marketplacePda: PublicKey;
  let treasuryPda: PublicKey;

  before(async () => {
    const adminSig = await provider.connection.requestAirdrop(
      admin.publicKey,
      2_000_000_000,
    );
    const adminBh = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      signature: adminSig,
      blockhash: adminBh,
      lastValidBlockHeight: adminBh.lastValidBlockHeight,
    });

    const daoOneSig = await provider.connection.requestAirdrop(
      daoOne.publicKey,
      2_000_000_000,
    );
    const daoOneBh = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      signature: daoOneSig,
      blockhash: daoOneBh,
      lastValidBlockHeight: daoOneBh.lastValidBlockHeight,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    marketplacePda = PublicKey.findProgramAddressSync(
      [Buffer.from("marketplace"), Buffer.from(marketplaceName)],
      program.programId,
    )[0];

    treasuryPda = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), marketplacePda.toBuffer()],
      program.programId,
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

      const marketplaceAccount =
        await program.account.marketplace.fetch(marketplacePda);
      expect(marketplaceAccount.admin.toString()).to.equal(
        admin.publicKey.toString(),
      );
      expect(marketplaceAccount.name).to.equal(marketplaceName);
      expect(marketplaceAccount.fee).to.equal(marketplaceFee);
    });
  });
});
