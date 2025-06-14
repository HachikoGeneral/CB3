import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PublicKey, Connection } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const RPC_URL = process.env.SOLANA_RPC_URL;
const connection = new Connection(RPC_URL, "confirmed");

const CYCLE_MINT = new PublicKey(process.env.CYCLE_MINT);
const APPROVED_MINTS = process.env.APPROVED_MINTS.split(",");

async function normalizeAmount(amount, decimals) {
  return BigInt(Math.round(parseFloat(amount) * 10 ** decimals));
}

// Checks last 10 txs from sender for a transfer of given token and amount
async function checkSenderSentToken({ connection, senderPubkey, tokenMint, expectedLamports }) {
  const signatures = await connection.getSignaturesForAddress(senderPubkey, { limit: 10 });

  for (const sigInfo of signatures) {
    const tx = await connection.getParsedTransaction(sigInfo.signature, { commitment: "confirmed" });
    if (!tx || !tx.transaction?.message?.instructions) continue;

    const instructions = tx.transaction.message.instructions;

    for (const ix of instructions) {
      if (ix.program === "spl-token" && ix.parsed?.type === "transfer") {
        const { source, amount, mint } = ix.parsed.info;

        // Confirm transfer *from* sender address and matching mint & amount
        if (
          source === senderPubkey.toBase58() &&
          mint === tokenMint.toBase58() &&
          BigInt(amount) === expectedLamports
        ) {
          console.log(`✅ Found valid transfer of ${mint} from sender in tx ${sigInfo.signature}`);
          return true;
        }
      }
    }
  }
  console.warn(`❌ No valid ${tokenMint.toBase58()} transfer found from sender`);
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

    const senderPubkey = new PublicKey(senderAddress);
    const cycleMint = CYCLE_MINT;
    const otherMint = new PublicKey(tokenName);

    const cycleMintInfo = await getMint(connection, cycleMint);
    const otherMintInfo = await getMint(connection, otherMint);

    const expectedCycleLamports = await normalizeAmount(cycleAmount, cycleMintInfo.decimals);
    const expectedTokenLamports = await normalizeAmount(tokenAmount, otherMintInfo.decimals);

    const sentCycle = await checkSenderSentToken({
      connection,
      senderPubkey,
      tokenMint: cycleMint,
      expectedLamports: expectedCycleLamports,
    });

    const sentOther = await checkSenderSentToken({
      connection,
      senderPubkey,
      tokenMint: otherMint,
      expectedLamports: expectedTokenLamports,
    });

    if (sentCycle && sentOther) {
      return res.json({ message: "✅ Sender sent correct amounts of both tokens in last 10 transactions." });
    } else {
      return res.status(400).json({
        error: "❌ Sender did not send correct amounts of both tokens in last 10 transactions.",
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
