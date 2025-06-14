import React, { useState, useEffect } from "react";

function App() {
  const [cycleAmount, setCycleAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState(
    "DL9sLSN488yMbots3wsbzHZ3UpKSkM42kr1y13CPpump"
  );
  const [tokenAmount, setTokenAmount] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [result, setResult] = useState("");
  const [cycleDecimals, setCycleDecimals] = useState(6);
  const [tokenDecimals, setTokenDecimals] = useState(6);

  const VAULT_ADDRESS = "CL2MjoDj4K2ACEFTnvRnKSTJdka2n1Nk585CYxgeik7M";

  const approvedTokens = {
    DL9sLSN488yMbots3wsbzHZ3UpKSkM42kr1y13CPpump: {
      label: "BitcoinBob",
      decimals: 6,
    },
    // add more tokens here with their decimals if needed
  };

  // When selectedToken changes, update decimals for tokenAmount input
  useEffect(() => {
    setTokenDecimals(approvedTokens[selectedToken]?.decimals || 6);
    // Keep tokenAmount synced 1:1 but formatted to correct decimals
    setTokenAmount(cycleAmount);
  }, [selectedToken]);

  // When cycleAmount changes, sync tokenAmount (1:1)
  const handleCycleAmountChange = (val) => {
    setCycleAmount(val);
    setTokenAmount(val);
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
          senderAddress: senderAddress.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult(`✅ Success: ${data.message}`);
      } else {
        setResult(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      console.error("Error during fetch:", err);
      setResult("❌ Server error. Please try again.");
    }
  };

  return (
    <div
      className="App"
      style={{ maxWidth: 600, margin: "40px auto", padding: 20 }}
    >
      <h1>🌀 $CYCLE 1:1 Token 🔥 Portal</h1>

      <p>
        <strong>Send tokens to vault:</strong>
        <br />
        <code>{VAULT_ADDRESS}</code>
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
        <div>
          <label>Sender Wallet Address:</label>
          <br />
          <input
            type="text"
            value={senderAddress}
            onChange={(e) => setSenderAddress(e.target.value)}
            required
            placeholder="Your Solana address"
            style={{ width: "100%", padding: 8, marginBottom: 10 }}
          />
        </div>

        <div>
          <label>Amount of $CYCLE:</label>
          <br />
          <input
            type="number"
            step={Math.pow(10, -cycleDecimals)}
            value={cycleAmount}
            onChange={(e) => handleCycleAmountChange(e.target.value)}
            required
            placeholder="e.g. 10"
            style={{ width: "100%", padding: 8, marginBottom: 10 }}
          />
        </div>

        <div>
          <label>Approved Token:</label>
          <br />
          <select
            value={selectedToken}
            onChange={(e) => {
              setSelectedToken(e.target.value);
            }}
            style={{ width: "100%", padding: 8, marginBottom: 10 }}
          >
            {Object.entries(approvedTokens).map(([mint, { label }]) => (
              <option key={mint} value={mint}>
                {label} ({mint.slice(0, 4)}...{mint.slice(-4)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Amount of {approvedTokens[selectedToken]?.label}:</label>
          <br />
          <input
            type="number"
            step={Math.pow(10, -tokenDecimals)}
            value={tokenAmount}
            onChange={(e) => setTokenAmount(e.target.value)}
            required
            placeholder="e.g. 10"
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
        <div style={{ marginTop: 20, padding: 10, whiteSpace: "pre-line" }}>
          <strong>{result}</strong>
        </div>
      )}
    </div>
  );
}

export default App;
