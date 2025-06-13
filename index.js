import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

const CYCLE_MINT = new PublicKey(process.env.CYCLE_TOKEN_MINT);
const VAULT_ADDRESS = new PublicKey(process.env.VAULT_ADDRESS);
const FALLBACK_ADDRESS = new PublicKey(process.env.FALLBACK_ADDRESS);

// ✅ Approved tokens list
const approvedTokens = {
  HouseCoin: "MintAddress_HouseCoinHere",
  AnotherToken: "MintAddress_AnotherTokenHere",
};

app.post("/api/validate-tokens", async (req, res) => {
  const { senderAddress, cycleAmount, tokenAmount, tokenName } = req.body;

  if (!senderAddress || !cycleAmount || !tokenAmount || !tokenName) {
    return res.status(400).json({ error: "Missing fields" });
  }

  if (cycleAmount !== tokenAmount) {
    return res.status(400).json({ error: "Amounts must match 1:1" });
  }

  const user = new PublicKey(senderAddress);
  const tokenMint = approvedTokens[tokenName];
  if (!tokenMint) return res.status(400).json({ error: "Invalid token" });

  const tokenMintKey = new PublicKey(tokenMint);

  try {
    // Get associated token accounts for vault
    const cycleVaultATA = await getAssociatedTokenAddress(CYCLE_MINT, VAULT_ADDRESS);
    const tokenVaultATA = await getAssociatedTokenAddress(tokenMintKey, VAULT_ADDRESS);

    const cycleVaultAccount = await getAccount(connection, cycleVaultATA);
    const tokenVaultAccount = await getAccount(connection, tokenVaultATA);

    // Get associated token accounts for user
    const cycleUserATA = await getAssociatedTokenAddress(CYCLE_MINT, user);
    const tokenUserATA = await getAssociatedTokenAddress(tokenMintKey, user);

    const cycleUserAccount = await getAccount(connection, cycleUserATA);
    const tokenUserAccount = await getAccount(connection, tokenUserATA);

    const cycleBalanceReceived =
      Number(cycleVaultAccount.amount) - Number(cycleUserAccount.amount);
    const tokenBalanceReceived =
      Number(tokenVaultAccount.amount) - Number(tokenUserAccount.amount);

    const lamports = 10 ** 6; // Assumes 6 decimal tokens (adjust if needed)

    const cycleAmountExpected = cycleAmount * lamports;
    const tokenAmountExpected = tokenAmount * lamports;

    const cycleOk = cycleBalanceReceived >= cycleAmountExpected;
    const tokenOk = tokenBalanceReceived >= tokenAmountExpected;

    if (cycleOk && tokenOk) {
      return res.json({ success: true, message: "✅ Both tokens received correctly." });
    } else {
      // Here you would send both tokens to the fallback address
      console.warn("Mismatch. Should transfer tokens to fallback vault:", FALLBACK_ADDRESS.toBase58());
      return res.status(400).json({
        error: "❌ Token amounts invalid or not received. Will redirect to fallback vault.",
      });
    }
  } catch (err) {
    console.error("Validation error:", err);
    return res.status(500).json({ error: "Server error validating tokens" });
  }
});

// Serve frontend statically
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
