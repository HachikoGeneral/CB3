import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

// Dummy approved tokens example
const approvedTokens = {
  HouseCoin: "TOKEN_MINT_ADDRESS_1",
  AnotherToken: "TOKEN_MINT_ADDRESS_2"
};

app.post("/api/validate-tokens", (req, res) => {
  const { cycleAmount, tokenAmount, tokenName } = req.body;

  if (!approvedTokens[tokenName]) {
    return res.status(400).json({ error: "Token not approved" });
  }
  if (cycleAmount !== tokenAmount) {
    return res.status(400).json({ error: "Amounts must be equal (1:1)" });
  }
  // Your real Solana token validation & transfer logic goes here

  return res.json({ success: true, message: `Received ${cycleAmount} $CYCLE and ${tokenAmount} ${tokenName}` });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from 'public'
app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
