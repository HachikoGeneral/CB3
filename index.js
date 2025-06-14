import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch"; // npm i node-fetch@2
import bs58 from "bs58";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const HAPI_KEY = process.env.SOLANA_RPC_URL.split("api-key=")[1];
const HAPI_BASE = "https://api.helius.xyz/v0";

// Use environment variables
const VAULT_ADDRESS = process.env.VAULT_ADDRESS;
const SECONDARY_WALLET_ADDRESS = process.env.SECONDARY_WALLET_ADDRESS;
const CYCLE_MINT = process.env.CYCLE_MINT;
const APPROVED_MINTS = process.env.APPROVED_MINTS.split(",");

// Helper: call Helius REST API
async function heliusFetch(endpoint) {
  const url = `${HAPI_BASE}${endpoint}?api-key=${HAPI_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Helius API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Normalize amount to lamports (BigInt)
async function normalizeAmount(amount, decimals) {
  return BigInt(Math.round(parseFloat(amount) * 10 ** decimals));
}

// Get mint info via Helius API (mint address can be alias or base58)
async function getMintInfo(mint) {
  // mint is a string alias or base58
  const info = await heliusFetch(`/tokens/mint/${mint}`);
  if (!info || !info.decimals) {
    throw new Error("Mint info not found");
  }
  return info;
}

// Get recent transactions for a given address (alias or base58)
async function getRecentTransactions(address) {
  // Helius endpoint returns array of transactions
  const txs = await heliusFetch(`/addresses/${address}/transactions`);
  return txs;
}

// Check if vault received expected amount from sender for given token mint
async function checkVaultDeposit({
  vaultTokenAccount,
  senderAddress,
  expectedLamports,
  tokenMint,
}) {
  const transactions = await getRecentTransactions(vaultTokenAccount);

  for (const tx of transactions) {
    if (!tx || !tx.instructions) continue;

    for (const ix of tx.instructions) {
      if (
        ix.program === "spl-token" &&
        ix.parsed?.type === "transfer"
      ) {
        const { source, destination, amount, mint } = ix.parsed.info;

        if (
          source === senderAddress &&
          destination === vaultTokenAccount &&
          mint === tokenMint &&
          BigInt(amount) === expectedLamports
        ) {
          console.log(`✅ Valid ${tokenMint} transfer from sender in tx: ${tx.signature}`);
          return true;
        }
      }
    }
  }

  console.warn(`❌ No valid ${tokenMint} transfer to vault found from sender ${senderAddress}`);
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

    // Mint info for cycle and other token (using aliases or base58)
    const cycleMintInfo = await getMintInfo(CYCLE_MINT);
    const otherMintInfo = await getMintInfo(tokenName);

    const expectedCycleLamports = await normalizeAmount(cycleAmount, cycleMintInfo.decimals);
    const expectedTokenLamports = await normalizeAmount(tokenAmount, otherMintInfo.decimals);

    // Vault associated token accounts (use vault address + mint string, as alias)
    // Here we assume vaultTokenAccount = vaultAddress (or you can add alias mapping if needed)
    // If you want, fetch associated token accounts from Helius or static config.

    // For simplicity, assume vault ATA == VAULT_ADDRESS (alias)
    const vaultCycleATA = VAULT_ADDRESS;
    const vaultOtherATA = VAULT_ADDRESS;

    const cycleDepositOk = await checkVaultDeposit({
      vaultTokenAccount: vaultCycleATA,
      senderAddress,
      expectedLamports: expectedCycleLamports,
      tokenMint: CYCLE_MINT,
    });

    const otherDepositOk = await checkVaultDeposit({
      vaultTokenAccount: vaultOtherATA,
      senderAddress,
      expectedLamports: expectedTokenLamports,
      tokenMint: tokenName,
    });

    if (cycleDepositOk && otherDepositOk) {
      return res.json({ message: "✅ Tokens received correctly in 1:1 amount." });
    } else {
      return res.status(400).json({
        error: "❌ Sender did not send correct amounts of both tokens in recent transactions.",
      });
    }
  } catch (err) {
    console.error("Error during token validation:", err);
    return res.status(500).json({ error: "Server error validating tokens" });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
