import React, { useState } from "react";
import "./App.css";

function App() {
  const [cycleAmount, setCycleAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("DL9sLSN488yMbots3wsbzHZ3UpKSkM42kr1y13CPpump");
  const [tokenAmount, setTokenAmount] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [result, setResult] = useState("");

  const VAULT_ADDRESS = "CL2MjoDj4K2ACEFTnvRnKSTJdka2n1Nk585CYxgeik7M";

  const approvedTokens = {
    "DL9sLSN488yMbots3wsbzHZ3UpKSkM42kr1y13CPpump": "BitcoinBob",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setResult("⏳ Validating on-chain...");

    try {
      const res = await fetch("/api/validate-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cycleAmount,
          tokenAmount,
          tokenName: selectedToken,
          senderAddress,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult(`✅ Success: ${data.message}`);
      } else {
        setResult(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      setResult("❌ Server error. Please try again.");
    }
  };

  return (
    <div className="App" style={{ maxWidth: 600, margin: "40px auto", padding: 20 }}>
      <h1>🌀 $CYCLE 1:1 Token Match Portal</h1>

      <p><strong>Send tokens to:</strong><br /><code>{VAULT_ADDRESS}</code></p>

      <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
        <div>
          <label>Sender Wallet Address:</label><br />
          <input
            type="text"
            value={senderAddress}
            onChange={(e) => setSenderAddress(e.target.value)}
            required
            style={{ width: "100%", padding: 8, marginBottom: 10 }}
          />
        </div>

        <div>
          <label>Amount of $CYCLE:</label><br />
          <input
            type="number"
            step="0.000001"
            value={cycleAmount}
            onChange={(e) => {
              setCycleAmount(e.target.value);
              setTokenAmount(e.target.value); // keep 1:1 match
            }}
            required
            style={{ width: "100%", padding: 8, marginBottom: 10 }}
          />
        </div>

        <div>
          <label>Approved Token:</label><br />
          <select
            value={selectedToken}
            onChange={(e) => setSelectedToken(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 10 }}
          >
            {Object.entries(approvedTokens).map(([mint, label]) => (
              <option key={mint} value={mint}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Amount of {approvedTokens[selectedToken]}:</label><br />
          <input
            type="number"
            step="0.000001"
            value={tokenAmount}
            onChange={(e) => setTokenAmount(e.target.value)}
            required
            style={{ width: "100%", padding: 8, marginBottom: 10 }}
          />
        </div>

        <button
          type="submit"
          style={{
            padding: "10px 20px",
            backgroundColor: "#1a73e8",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Validate Tokens
        </button>
      </form>

      {result && (
        <div style={{ marginTop: 20, padding: 10 }}>
          <strong>{result}</strong>
        </div>
      )}
    </div>
  );
}

export default App;
