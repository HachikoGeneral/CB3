const [senderAddress, setSenderAddress] = useState("");

...

<label>
  Sender wallet address:
  <input
    type="text"
    value={senderAddress}
    onChange={(e) => setSenderAddress(e.target.value)}
    required
  />
</label>
