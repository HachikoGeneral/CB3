import express from "express";
import dotenv from "dotenv";
import path from "path";
import { PublicKey, Connection } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
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

app.post("/api/validate-tokens", async (req, res) => {
  try {
    const { cycleAmount, tokenAmount, tokenName, senderAddress } = req.body;

    if (!senderAddress || !cycleAmount || !tokenAmount || !tokenName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!APPROVED_MINTS.includes(tokenName)) {
      return res.status(400).json({ error: "Token not approved" });
    }

    const cycleMint = new PublicKey(CYCLE_MINT);
    const otherMint = new PublicKey(tokenName);

    // Get decimals for both tokens
    const cycleMintInfo = await getMint(connection, cycleMint);
    const otherMintInfo = await getMint(connection, otherMint);

    // Normalize input amounts from frontend (strings/numbers) into lamports
    // e.g. 100.5 tokens with 6 decimals => 100500000 lamports
    const normalizeAmount = (amount, decimals) =>
      BigInt(Math.round(parseFloat(amount) * 10 ** decimals));

    const expectedCycleLamports = normalizeAmount(cycleAmount, cycleMintInfo.decimals);
    const expectedTokenLamports = normalizeAmount(tokenAmount, otherMintInfo.decimals);

    // Get vault token accounts
    const cycleVaultATA = await getAssociatedTokenAddress(cycleMint, VAULT_ADDRESS);
    const tokenVaultATA = await getAssociatedTokenAddress(otherMint, VAULT_ADDRESS);

    let cycleVaultAmount = 0n;
    let tokenVaultAmount = 0n;

    try {
      const cycleVaultAcc = await getAccount(connection, cycleVaultATA);
      cycleVaultAmount = cycleVaultAcc.amount;
    } catch (err) {
      if (err.name !== "TokenAccountNotFoundError") throw err;
    }

    try {
      const tokenVaultAcc = await getAccount(connection, tokenVaultATA);
      tokenVaultAmount = tokenVaultAcc.amount;
    } catch (err) {
      if (err.name !== "TokenAccountNotFoundError") throw err;
    }

    // No tokens received yet
    if (cycleVaultAmount === 0n && tokenVaultAmount === 0n) {
      return res.status(400).json({ error: "No tokens received yet. Please send both tokens to the vault." });
    }

    // Compare vault token amounts to expected amounts and each other
    if (
      cycleVaultAmount === tokenVaultAmount &&
      cycleVaultAmount === expectedCycleLamports &&
      tokenVaultAmount === expectedTokenLamports
    ) {
      return res.json({ message: "Tokens received in correct 1:1 amount and will be routed to vault." });
    } else {
      return res.status(400).json({
        error: `Token amounts do not match 1:1. Tokens will be routed to the secondary wallet.`,
      });
    }
  } catch (err) {
    console.error("Error during token validation:", err);
    return res.status(500).json({ error: "Server error validating tokens" });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
