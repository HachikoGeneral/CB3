import React, { useState } from "react";

const approvedTokens = ["HouseCoin", "AnotherToken"]; // Populate with real names

export default function App() {
  const [senderAddress, setSenderAddress] = useState("");
  const [cycleAmount, setCycleAmount] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState(approvedTokens[0]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const VAULT_ADDRESS = "YourReceiverWalletAddressHere"; // Replace with actual vault wallet

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/validate-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderAddress,
          cycleAmount: Number(cycleAmount),
          tokenAmount: Number(tokenAmount),
          tokenName: selectedToken,
        }),
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: "Server error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: "auto", padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h2>1:1 Token Validation Portal</h2>
      <p>
        Manually send <strong>$CYCLE</strong> and one other token (from dropdown) in a <strong>1:1 ratio</strong> to the vault address.
        Then, submit this form to verify.
      </p>

      <form onSubmit={handleSubmit}>
        <label>
          Sender Wallet Address:
          <input
            type="text"
            value={senderAddress}
            onChange={(e) => setSenderAddress(e.target.value)}
            required
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </label>
        <br />

        <label>
          $CYCLE Amount:
          <input
            type="number"
            value={cycleAmount}
            onChange={(e) => setCycleAmount(e.target.value)}
            required
            min="1"
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </label>
        <br />

        <label>
          Select Token:
          <select
            value={selectedToken}
            onChange={(e) => setSelectedToken(e.target.value)}
            style={{ width: "100%", marginBottom: "10px" }}
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
          {selectedToken} Amount:
          <input
            type="number"
            value={tokenAmount}
            onChange={(e) => setTokenAmount(e.target.value)}
            required
            min="1"
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </label>
        <br />

        <button type="submit" disabled={loading}>
          {loading ? "Validating..." : "Submit"}
        </button>
      </form>

      {result && (
        <div style={{ marginTop: 20 }}>
          {result.success && (
            <p style={{ color: "green" }}>{result.message}</p>
          )}
          {result.error && (
            <p style={{ color: "red" }}>Error: {result.error}</p>
          )}
        </div>
      )}

      <hr style={{ margin: "30px 0" }} />

      <div>
        <h4>Vault Address</h4>
        <code>{VAULT_ADDRESS}</code>
        <p>
          Send <strong>both</strong> tokens here <strong>before</strong> submitting the form.
        </p>
      </div>
    </div>
  );
}

