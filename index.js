import express from "express";
import dotenv from "dotenv";
import path from "path";
import { PublicKey, Connection } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
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

    const cycleVaultATA = await getAssociatedTokenAddress(cycleMint, VAULT_ADDRESS);
    const tokenVaultATA = await getAssociatedTokenAddress(otherMint, VAULT_ADDRESS);

    let cycleVaultAmount = 0;
    let tokenVaultAmount = 0;

    try {
      const cycleVaultAcc = await getAccount(connection, cycleVaultATA);
      cycleVaultAmount = Number(cycleVaultAcc.amount);
    } catch (err) {
      if (err.name !== "TokenAccountNotFoundError") throw err;
    }

    try {
      const tokenVaultAcc = await getAccount(connection, tokenVaultATA);
      tokenVaultAmount = Number(tokenVaultAcc.amount);
    } catch (err) {
      if (err.name !== "TokenAccountNotFoundError") throw err;
    }

    // Amounts must be equal
    if (cycleVaultAmount === 0 && tokenVaultAmount === 0) {
      return res.status(400).json({ error: "No tokens received yet. Please send both tokens to the vault." });
    }

    if (cycleVaultAmount === tokenVaultAmount && cycleVaultAmount === Number(cycleAmount)) {
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
