import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PublicKey, Connection } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const RPC_URL = process.env.SOLANA_RPC_URL;
const connection = new Connection(RPC_URL, "confirmed");

const VAULT_ADDRESS = new PublicKey(process.env.VAULT_ADDRESS);
const CYCLE_MINT = new PublicKey(process.env.CYCLE_MINT);
const APPROVED_MINTS = process.env.APPROVED_MINTS.split(",").map(s => s.trim());

const MAX_ATTEMPTS = 10;
const POLL_DELAY_MS = 3000;

// Convert float token amount to lamports (BigInt)
async function normalizeAmount(amount, decimals) {
  return BigInt(Math.round(parseFloat(amount) * 10 ** decimals));
}

// Check if vault received expected amount of token, from sender ATA
async function checkVaultDeposit({
  connection,
  vaultTokenAccount,
  senderPubkey,
  expectedLamports,
  tokenMint,
}) {
  const senderATA = await getAssociatedTokenAddress(tokenMint, senderPubkey);
  const signatures = await connection.getSignaturesForAddress(vaultTokenAccount, { limit: 30 });

  for (const sigInfo of signatures) {
    const tx = await connection.getParsedTransaction(sigInfo.signature, {
      commitment: "confirmed",
    });

    if (!tx || !tx.transaction?.message?.instructions) continue;

    const instructions = tx.transaction.message.instructions;

    for (const ix of instructions) {
      if (ix.program === "spl-token" && ix.parsed?.type === "transfer") {
        const { source, destination, amount } = ix.parsed.info;

        if (
          source === senderATA.toBase58() &&
          destination === vaultTokenAccount.toBase58() &&
          BigInt(amount) === expectedLamports
        ) {
          console.log(`✅ Valid ${tokenMint.toBase58()} transfer from sender in tx: ${sigInfo.signature}`);
          return true;
        }
      }
    }
  }

  console.warn(`❌ No valid ${tokenMint.toBase58()} transfer to vault found from sender ${senderPubkey.toBase58()}`);
  return false;
}

// Extracted validator
async function attemptValidation({ senderAddress, cycleAmount, tokenAmount, tokenName }) {
  if (!senderAddress || !cycleAmount || !tokenAmount || !tokenName) {
    return { ok: false, error: "Missing required fields" };
  }

  if (!APPROVED_MINTS.includes(tokenName)) {
    return { ok: false, error: "Token not approved" };
  }

  try {
    const cycleMint = CYCLE_MINT;
    const otherMint = new PublicKey(tokenName);
    const senderPubkey = new PublicKey(senderAddress);

    const cycleMintInfo = await getMint(connection, cycleMint);
    const otherMintInfo = await getMint(connection, otherMint);

    const expectedCycleLamports = await normalizeAmount(cycleAmount, cycleMintInfo.decimals);
    const expectedTokenLamports = await normalizeAmount(tokenAmount, otherMintInfo.decimals);

    const vaultCycleATA = await getAssociatedTokenAddress(cycleMint, VAULT_ADDRESS);
    const vaultOtherATA = await getAssociatedTokenAddress(otherMint, VAULT_ADDRESS);

    const cycleDepositOk = await checkVaultDeposit({
      connection,
      vaultTokenAccount: vaultCycleATA,
      senderPubkey,
      expectedLamports: expectedCycleLamports,
      tokenMint: cycleMint,
    });

    const otherDepositOk = await checkVaultDeposit({
      connection,
      vaultTokenAccount: vaultOtherATA,
      senderPubkey,
      expectedLamports: expectedTokenLamports,
      tokenMint: otherMint,
    });

    if (cycleDepositOk && otherDepositOk) {
      return { ok: true };
    } else {
      return {
        ok: false,
        error: "Tokens not yet received.",
        details: { cycleDepositOk, otherDepositOk },
      };
    }
  } catch (err) {
    console.error("Validation error:", err);
    return { ok: false, error: "Internal error", details: err.message };
  }
}

// Main API route with polling
app.post("/api/validate-tokens", async (req, res) => {
  const input = req.body;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`🔁 Polling attempt ${attempt}/${MAX_ATTEMPTS} for ${input.senderAddress}...`);

    const result = await attemptValidation(input);

    if (result.ok) {
      return res.json({ message: "✅ Tokens received correctly in 1:1 amount." });
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, POLL_DELAY_MS));
    } else {
      return res.status(408).json({
        error: "❌ Token transfer not detected in time.",
        details: result.details || null,
      });
    }
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
