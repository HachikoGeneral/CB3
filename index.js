import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  Connection,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 📍 Load and validate .env config
const {
  SOLANA_RPC_URL,
  VAULT_ADDRESS,
  SECONDARY_WALLET_ADDRESS,
  CYCLE_MINT,
  APPROVED_MINTS,
} = process.env;

if (!VAULT_ADDRESS || !SECONDARY_WALLET_ADDRESS || !CYCLE_MINT || !APPROVED_MINTS) {
  throw new Error("❌ Missing one or more required .env variables.");
}

// 📍 Setup
const connection = new Connection(SOLANA_RPC_URL || clusterApiUrl("mainnet-beta"), "confirmed");
const vaultAddress = new PublicKey(VAULT_ADDRESS);
const secondaryAddress = new PublicKey(SECONDARY_WALLET_ADDRESS);
const cycleMint = new PublicKey(CYCLE_MINT);
const approvedMints = APPROVED_MINTS.split(",").map((m) => m.trim());

// 🧠 Validation endpoint
app.post("/api/validate-tokens", async (req, res) => {
  const { senderAddress, cycleAmount, tokenAmount, tokenName } = req.body;

  if (!senderAddress || !cycleAmount || !tokenAmount || !tokenName) {
    return res.status(400).json({ error: "Missing input fields" });
  }

  const cycleAmt = parseFloat(cycleAmount);
  const tokenAmt = parseFloat(tokenAmount);
  if (cycleAmt !== tokenAmt) {
    return res.status(400).json({ error: "Amounts must be exactly 1:1" });
  }

  const user = new PublicKey(senderAddress);
  const tokenMint = new PublicKey(tokenName); // frontend sends mint directly

  if (!approvedMints.includes(tokenMint.toBase58())) {
    return res.status(400).json({ error: "Token mint not approved" });
  }

  try {
    // 🪙 Get token accounts for vault
    const cycleVaultATA = await getAssociatedTokenAddress(cycleMint, vaultAddress);
    const tokenVaultATA = await getAssociatedTokenAddress(tokenMint, vaultAddress);

    const cycleVaultAcc = await getAccount(connection, cycleVaultATA);
    const tokenVaultAcc = await getAccount(connection, tokenVaultATA);

    const cycleVaultAmount = Number(cycleVaultAcc.amount);
    const tokenVaultAmount = Number(tokenVaultAcc.amount);

    // 🔎 Get user token accounts to check origin (optional logic)
    const cycleUserATA = await getAssociatedTokenAddress(cycleMint, user);
    const tokenUserATA = await getAssociatedTokenAddress(tokenMint, user);

    const cycleUserAcc = await getAccount(connection, cycleUserATA);
    const tokenUserAcc = await getAccount(connection, tokenUserATA);

    const expectedAmount = cycleAmt * 10 ** 6; // Adjust if tokens use different decimals

    const cycleOk = cycleVaultAmount >= expectedAmount;
    const tokenOk = tokenVaultAmount >= expectedAmount;

    if (cycleOk && tokenOk) {
      return res.json({
        success: true,
        message: "✅ Both tokens received in correct 1:1 ratio.",
      });
    } else {
      // ❌ One or both were missing — simulate redirect to secondary vault
      console.log("❌ Invalid deposit. Tokens should be sent to:", secondaryAddress.toBase58());
      return res.status(400).json({
        error:
          "One or both tokens not received in correct 1:1 ratio. They will be redirected to secondary vault.",
      });
    }
  } catch (err) {
    console.error("Error during token validation:", err);
    return res.status(500).json({ error: "Server error validating tokens." });
  }
});

// ⚙️ Serve React app (in /public)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
