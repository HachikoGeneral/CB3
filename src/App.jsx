import React, { useState } from "react";

const approvedTokens = ["HouseCoin", "AnotherToken"];

export default function App() {
  const [cycleAmount, setCycleAmount] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState(approvedTokens[0]);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();

    const res = await fetch("/api/validate-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cycleAmount: Number(cycleAmount),
        tokenAmount: Number(tokenAmount),
        tokenName: selectedToken,
      }),
    });

    const data = await res.json();
    setResult(data);
  }

  return (
    <div style={{ maxWidth: 400, margin: "auto", padding: 20, fontFamily: "Arial" }}>
      <h2>1:1 Token Validation</h2>
      <p>Send <b>$CYCLE</b> and another approved token 1:1 (same amounts).</p>
      <form onSubmit={handleSubmit}>
        <label>
          $CYCLE amount:
          <input
            type="number"
            value={cycleAmount}
            onChange={(e) => setCycleAmount(e.target.value)}
            required
            min="1"
          />
        </label>
        <br />
        <label>
          Select token:
          <select
            value={selectedToken}
            onChange={(e) => setSelectedToken(e.target.value)}
          >
            {approvedTokens.map((token) => (
              <option key={token} value={token}>
                {token}
              </option>
            ))}
          </select>
        </label>
        <br />
        <label>
          {selectedToken} amount:
          <input
            type="number"
            value={tokenAmount}
            onChange={(e) => setTokenAmount(e.target.value)}
            required
            min="1"
          />
        </label>
        <br />
        <button type="submit">Validate</button>
      </form>
      <div style={{ marginTop: 20 }}>
        {result && result.success && (
          <p style={{ color: "green" }}>{result.message}</p>
        )}
        {result && result.error && (
          <p style={{ color: "red" }}>Error: {result.error}</p>
        )}
      </div>
      <hr />
      <p>
        Send tokens to this wallet address:
        <br />
        <code>YOUR_SOLANA_WALLET_ADDRESS_HERE</code>
      </p>
    </div>
  );
}
