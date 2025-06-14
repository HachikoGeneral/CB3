import express from "express";
import dotenv from "dotenv";
import path from "path";
import { PublicKey, Connection } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.resolve();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const RPC_URL = process.env.SOLANA_RPC_URL;
const connection = new Connection(RPC_URL, "confirmed");

const VAULT_ADDRESS = new PublicKey(process.env.VAULT_ADDRESS);
const SECONDARY_WALLET_ADDRESS = new PublicKey(process.env.SECONDARY_WALLET_ADDRESS);
const CYCLE_MINT = new PublicKey(process.env.CYCLE_MINT);
const APPROVED_MINTS = process.env.APPROVED_MINTS.split(",");

async function normalizeAmount(amount, decimals) {
  return BigInt(Math.round(parseFloat(amount) * 10 ** decimals));
}

async function checkSenderDeposit({
  connection,
  vaultTokenAccount,
  senderPubkey,
  expectedLamports,
  tokenMint,
}) {
  const senderTokenAccount = await getAssociatedTokenAddress(tokenMint, senderPubkey);
  const signatures = await connection.getSignaturesForAddress(vaultTokenAccount, { limit: 50 });

  for (const sigInfo of signatures) {
    const tx = await connection.getParsedTransaction(sigInfo.signature, {
      commitment: "confirmed",
    });

    if (!tx || !tx.transaction?.message?.instructions) continue;

    const instructions = tx.transaction.message.instructions;

    for (const ix of instructions) {
      if (ix.program === "spl-token" && ix.parsed?.type === "transfer") {
        const { source, destination, amount } = ix.parsed.info;

        // Debug logging
        console.log(`➡️ [Transfer in tx ${sigInfo.signature}]`);
        console.log(`  Source:      ${source}`);
        console.log(`  Destination: ${destination}`);
        console.log(`  Amount:      ${amount}`);
        console.log(`  Expected:    ${expectedLamports.toString()}`);
        console.log(`  Sender ATA:  ${senderTokenAccount.toBase58()}`);
        console.log(`  Vault ATA:   ${vaultTokenAccount.toBase58()}`);

        if (
          destination === vaultTokenAccount.toBase58() &&
          source === senderTokenAccount.toBase58() &&
          BigInt(amount) === expectedLamports
        ) {
          console.log(`✅ Valid transfer matched in tx: ${sigInfo.signature}`);
          return true;
        }
      }
    }
  }

  console.warn(`❌ No valid ${tokenMint.toBase58()} transfer found from ${senderPubkey.toBase58()}`);
  return false;
}

app.post("/api/validate-tokens", async (req, res) => {
  try {
    const { cycleAmount, tokenAmount, tokenName, senderAddress } = req.body;

    if (!senderAddress || !cycleAmount || !tokenAmount || !tokenName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!APPROVED_MINTS.includes(tokenName)) {
      return res.status(400).json({ error: "Token not approved" });
    }

    const cycleMint = CYCLE_MINT;
    const otherMint = new PublicKey(tokenName);
    const senderPubkey = new PublicKey(senderAddress);

    // Get mint decimals
    const cycleMintInfo = await getMint(connection, cycleMint);
    const otherMintInfo = await getMint(connection, otherMint);

    const expectedCycleLamports = await normalizeAmount(cycleAmount, cycleMintInfo.decimals);
    const expectedTokenLamports = await normalizeAmount(tokenAmount, otherMintInfo.decimals);

    // Get vault token accounts
    const vaultCycleATA = await getAssociatedTokenAddress(cycleMint, VAULT_ADDRESS);
    const vaultOtherATA = await getAssociatedTokenAddress(otherMint, VAULT_ADDRESS);

    // Check for valid token deposits
    const cycleDepositOk = await checkSenderDeposit({
      connection,
      vaultTokenAccount: vaultCycleATA,
      senderPubkey,
      expectedLamports: expectedCycleLamports,
      tokenMint: cycleMint,
    });

    const otherDepositOk = await checkSenderDeposit({
      connection,
      vaultTokenAccount: vaultOtherATA,
      senderPubkey,
      expectedLamports: expectedTokenLamports,
      tokenMint: otherMint,
    });

    if (cycleDepositOk && otherDepositOk) {
      return res.json({ message: "✅ Tokens received correctly in 1:1 amount." });
    } else {
      return res.status(400).json({
        error: "❌ Tokens not received correctly or amounts do not match 1:1.",
      });
    }
  } catch (err) {
    console.error("❌ Error during token validation:", err);
    return res.status(500).json({ error: "Server error validating tokens" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
