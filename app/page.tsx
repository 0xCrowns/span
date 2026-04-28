"use client";

import { useEffect, useRef, useState } from "react";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

type Action = "bridge" | "transfer" | "swap";
type Tab = "bridge" | "swap" | "transfer" | "faucet";

type Status = {
  loading: boolean;
  message: string;
  result?: string;
};

type Payload = {
  fromChain: string;
  toChain: string;
  amount: string;
  recipient: string;
  sourceToken: string;
  destinationToken: string;
  token: string;
  slippageBps: number;
};

type HistoryItem = {
  id: string;
  action: Action | "quote";
  description: string;
  result: string;
  success: boolean;
  timestamp: string;
};

const supportedChains = [
  { label: "Ethereum Sepolia", value: "Ethereum_Sepolia" },
  { label: "Arc Testnet", value: "Arc_Testnet" },
  { label: "Polygon Mumbai", value: "Polygon_Mumbai" },
  { label: "Optimism Goerli", value: "Optimism_Goerli" },
];

const supportedTokens = ["USDC", "USDT", "EURC", "NATIVE", "DAI", "ETH"];

const initialPayload: Payload = {
  fromChain: "Ethereum_Sepolia",
  toChain: "Arc_Testnet",
  amount: "1.00",
  recipient: "",
  sourceToken: "USDC",
  destinationToken: "USDC",
  token: "USDC",
  slippageBps: 300,
};

const appKitQuoteKey = process.env.NEXT_PUBLIC_APP_KIT_KEY ?? "";

function mapChainId(chainId: string | number | undefined) {
  const id = String(chainId ?? "");
  switch (id) {
    case "0xAA36A7":
    case "11155111":
      return "Ethereum Sepolia";
    case "0x1EAF2":
    case "2001770":
      return "Arc Testnet";
    default:
      return id ? `Chain ${id}` : "Unknown network";
  }
}

export default function Page() {
  const [activeTab, setActiveTab] = useState<Tab>("bridge");
  const [status, setStatus] = useState<Status>({
    loading: false,
    message: "Ready to execute.",
  });
  const [payload, setPayload] = useState<Payload>(initialPayload);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletChain, setWalletChain] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [quoteResult, setQuoteResult] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const adapterRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("span-action-history");
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        setHistory([]);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("span-action-history", JSON.stringify(history));
  }, [history]);

  const addHistory = (item: Omit<HistoryItem, "id" | "timestamp">) => {
    setHistory((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date().toISOString(),
        ...item,
      },
      ...current.slice(0, 7),
    ]);
  };

  const connectWallet = async () => {
    setWalletError(null);
    setStatus({ loading: true, message: "Connecting wallet..." });

    try {
      const anyWindow = window as any;
      const provider = anyWindow.ethereum;

      if (!provider) {
        throw new Error("No browser wallet detected. Install MetaMask.");
      }

      const accounts = await provider.request({ method: "eth_requestAccounts" });

      if (!Array.isArray(accounts) || accounts.length === 0) {
        throw new Error("Unable to get wallet accounts.");
      }

      const adapter = await createViemAdapterFromProvider({
        provider,
        capabilities: { addressContext: "user-controlled" },
      });

      adapterRef.current = adapter;
      setWalletConnected(true);
      setWalletAddress(String(accounts[0]));
      setWalletChain(mapChainId(provider.chainId));
      setStatus({ loading: false, message: "Wallet connected." });
    } catch (error: unknown) {
      setWalletConnected(false);
      setStatus({ loading: false, message: "Wallet connection failed." });
      setWalletError(error instanceof Error ? error.message : "Failed to connect.");
    }
  };

  const executeBrowserAction = async (action: Action) => {
    const kit = new AppKit();
    const adapter = adapterRef.current;

    if (!adapter) {
      throw new Error("Browser wallet adapter not available.");
    }

    if (action === "bridge") {
      return kit.bridge({
        from: { adapter, chain: payload.fromChain as any },
        to: { adapter, chain: payload.toChain as any },
        amount: payload.amount,
        token: payload.token as any,
      });
    }

    if (action === "transfer") {
      return kit.send({
        from: { adapter, chain: payload.fromChain as any },
        to: payload.recipient,
        amount: payload.amount,
        token: payload.token as any,
      });
    }

    return kit.swap({
      from: { adapter, chain: payload.fromChain as any },
      tokenIn: payload.sourceToken as any,
      tokenOut: payload.destinationToken as any,
      amountIn: payload.amount,
      config: {
        slippageBps: payload.slippageBps,
        kitKey: appKitQuoteKey || undefined,
      },
    });
  };

  const submitAction = async (action: Action) => {
    setStatus({ loading: true, message: `${action} in progress...` });
    setQuoteResult(null);

    try {
      let responseData: any;

      if (walletConnected && adapterRef.current) {
        const result = await executeBrowserAction(action);
        responseData = result;
      } else {
        const response = await fetch(`/api/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Action failed on the server.");
        }
        responseData = data.result;
      }

      const detail = typeof responseData === "object" ? JSON.stringify(responseData, null, 2) : String(responseData);
      setStatus({ loading: false, message: `${action} completed successfully.`, result: detail });
      addHistory({
        action,
        description: `${action} ${payload.amount} ${action === "swap" ? `${payload.sourceToken}→${payload.destinationToken}` : payload.token} on ${payload.fromChain}`,
        result: "success",
        success: true,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Action failed.";
      setStatus({ loading: false, message });
      addHistory({
        action,
        description: `${action} ${payload.amount} failed on ${payload.fromChain}`,
        result: message,
        success: false,
      });
    }
  };

  const requestSwapQuote = async () => {
    setStatus({ loading: true, message: "Requesting swap quote..." });
    setQuoteResult(null);

    try {
      if (walletConnected && adapterRef.current) {
        const kit = new AppKit();
        const result = await kit.estimateSwap({
          from: { adapter: adapterRef.current, chain: payload.fromChain as any },
          tokenIn: payload.sourceToken as any,
          tokenOut: payload.destinationToken as any,
          amountIn: payload.amount,
          config: {
            slippageBps: payload.slippageBps,
            kitKey: appKitQuoteKey || undefined,
          },
        });

        const formatted = JSON.stringify(result, null, 2);
        setQuoteResult(formatted);
        setStatus({ loading: false, message: "Swap quote retrieved successfully.", result: formatted });
        addHistory({ action: "quote", description: `Swap quote ${payload.sourceToken}→${payload.destinationToken} on ${payload.fromChain}`, result: "success", success: true });
        return;
      }

      const response = await fetch(`/api/quote-swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Quote request failed.");
      }

      setQuoteResult(JSON.stringify(data.result, null, 2));
      setStatus({ loading: false, message: "Swap quote retrieved successfully.", result: JSON.stringify(data.result, null, 2) });
      addHistory({ action: "quote", description: `Swap quote ${payload.sourceToken}→${payload.destinationToken} on ${payload.fromChain}`, result: "success", success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Quote request failed.";
      setStatus({ loading: false, message });
      addHistory({ action: "quote", description: `Swap quote failed on ${payload.fromChain}`, result: message, success: false });
    }
  };

  const renderBridgeTab = () => (
    <section>
      <h2>Bridge</h2>
      <p>Bridge tokens across supported EVM networks.</p>
      <fieldset>
        <label>
          Source chain
          <select
            value={payload.fromChain}
            onChange={(event) => setPayload((current) => ({ ...current, fromChain: event.target.value }))}
          >
            {supportedChains.map((chain) => (
              <option key={chain.value} value={chain.value}>
                {chain.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Destination chain
          <select
            value={payload.toChain}
            onChange={(event) => setPayload((current) => ({ ...current, toChain: event.target.value }))}
          >
            {supportedChains.map((chain) => (
              <option key={chain.value} value={chain.value}>
                {chain.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Token
          <select
            value={payload.token}
            onChange={(event) => setPayload((current) => ({ ...current, token: event.target.value }))}
          >
            {supportedTokens.map((token) => (
              <option key={token} value={token}>
                {token}
              </option>
            ))}
          </select>
        </label>
        <label>
          Amount
          <input
            type="number"
            min="0"
            step="0.01"
            value={payload.amount}
            onChange={(event) => setPayload((current) => ({ ...current, amount: event.target.value }))}
          />
        </label>
      </fieldset>
      <button disabled={status.loading} onClick={() => submitAction("bridge")}>Bridge</button>
    </section>
  );

  const renderSwapTab = () => (
    <section>
      <h2>Swap</h2>
      <p>Swap tokens on a single chain and preview quotes before you execute.</p>
      <fieldset>
        <label>
          Chain
          <select
            value={payload.fromChain}
            onChange={(event) => setPayload((current) => ({ ...current, fromChain: event.target.value }))}
          >
            {supportedChains.map((chain) => (
              <option key={chain.value} value={chain.value}>
                {chain.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          From token
          <select
            value={payload.sourceToken}
            onChange={(event) => setPayload((current) => ({ ...current, sourceToken: event.target.value }))}
          >
            {supportedTokens.map((token) => (
              <option key={token} value={token}>
                {token}
              </option>
            ))}
          </select>
        </label>
        <label>
          To token
          <select
            value={payload.destinationToken}
            onChange={(event) => setPayload((current) => ({ ...current, destinationToken: event.target.value }))}
          >
            {supportedTokens.map((token) => (
              <option key={token} value={token}>
                {token}
              </option>
            ))}
          </select>
        </label>
        <label>
          Amount in
          <input
            type="number"
            min="0"
            step="0.01"
            value={payload.amount}
            onChange={(event) => setPayload((current) => ({ ...current, amount: event.target.value }))}
          />
        </label>
        <label>
          Slippage (BPS)
          <input
            type="number"
            min="0"
            max="1000"
            step="10"
            value={payload.slippageBps}
            onChange={(event) => setPayload((current) => ({ ...current, slippageBps: Number(event.target.value) }))}
          />
        </label>
      </fieldset>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
        <button disabled={status.loading} onClick={requestSwapQuote}>Preview Quote</button>
        <button disabled={status.loading} onClick={() => submitAction("swap")}>Swap</button>
      </div>
    </section>
  );

  const renderTransferTab = () => (
    <section>
      <h2>Transfer</h2>
      <p>Send tokens to another wallet address on the same chain.</p>
      <fieldset>
        <label>
          Recipient address
          <input
            placeholder="0x..."
            value={payload.recipient}
            onChange={(event) => setPayload((current) => ({ ...current, recipient: event.target.value }))}
          />
        </label>
        <label>
          Chain
          <select
            value={payload.fromChain}
            onChange={(event) => setPayload((current) => ({ ...current, fromChain: event.target.value }))}
          >
            {supportedChains.map((chain) => (
              <option key={chain.value} value={chain.value}>
                {chain.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Token
          <select
            value={payload.token}
            onChange={(event) => setPayload((current) => ({ ...current, token: event.target.value }))}
          >
            {supportedTokens.map((token) => (
              <option key={token} value={token}>
                {token}
              </option>
            ))}
          </select>
        </label>
        <label>
          Amount
          <input
            type="number"
            min="0"
            step="0.01"
            value={payload.amount}
            onChange={(event) => setPayload((current) => ({ ...current, amount: event.target.value }))}
          />
        </label>
      </fieldset>
      <button disabled={status.loading || !payload.recipient} onClick={() => submitAction("transfer")}>Transfer</button>
    </section>
  );

  const renderFaucetTab = () => (
    <section>
      <h2>Get Faucet</h2>
      <p>Get test tokens from Circle's faucet to use on test networks.</p>
      
      <div className="faucet-info">
        <h3>How to Get Test Tokens</h3>
        <ol>
          <li>Visit <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer">https://faucet.circle.com/</a></li>
          <li>Connect your wallet (MetaMask or other EIP-1193 wallet)</li>
          <li>Select the test network you want tokens for (Ethereum Sepolia, Arc Testnet, Polygon Mumbai, etc.)</li>
          <li>Request USDC or EURC test tokens</li>
          <li>Wait for the tokens to arrive in your wallet</li>
        </ol>
        
        <p className="note">
          <strong>Note:</strong> Faucet tokens are for testing purposes only and have no real value.
          They can only be used on test networks.
        </p>
        
        <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" className="faucet-button">
          Go to Circle Faucet
        </a>
      </div>
    </section>
  );

  return (
    <main>
      <header>
        <h1>span</h1>
        <p>Swap, bridge, and transfer tokens across EVM networks.</p>
      </header>

      <nav className="tabs">
        <button
          className={activeTab === "bridge" ? "active" : ""}
          onClick={() => setActiveTab("bridge")}
        >
          Bridge
        </button>
        <button
          className={activeTab === "swap" ? "active" : ""}
          onClick={() => setActiveTab("swap")}
        >
          Swap
        </button>
        <button
          className={activeTab === "transfer" ? "active" : ""}
          onClick={() => setActiveTab("transfer")}
        >
          Transfer
        </button>
        <button
          className={activeTab === "faucet" ? "active" : ""}
          onClick={() => setActiveTab("faucet")}
        >
          Get Faucet
        </button>
      </nav>

      <section>
        <fieldset>
          <legend>Wallet</legend>
          <p>{walletConnected ? `Connected: ${walletAddress}` : "Not connected."}</p>
          <p>{walletChain ? `Network: ${walletChain}` : ""}</p>
          <button disabled={status.loading} onClick={connectWallet}>
            {walletConnected ? "Reconnect" : "Connect Wallet"}
          </button>
          {walletError ? <p className="status">{walletError}</p> : null}
        </fieldset>
      </section>

      {activeTab === "bridge" && renderBridgeTab()}
      {activeTab === "swap" && renderSwapTab()}
      {activeTab === "transfer" && renderTransferTab()}
      {activeTab === "faucet" && renderFaucetTab()}

      <section>
        <h2>Status</h2>
        <div className="status">
          <strong>Status:</strong> {status.message}
          {status.result ? <pre className="pre">{status.result}</pre> : null}
        </div>
        {quoteResult ? (
          <div className="status">
            <strong>Quote result</strong>
            <pre className="pre">{quoteResult}</pre>
          </div>
        ) : null}
      </section>

      <section>
        <h2>Recent activity</h2>
        {history.length === 0 ? (
          <p>No actions yet.</p>
        ) : (
          history.map((entry) => (
            <div key={entry.id} className="status">
              <strong>{entry.action.toUpperCase()}</strong> · {entry.description}
              <div>{entry.timestamp}</div>
              <div>{entry.success ? "Success" : "Error"}: {entry.result}</div>
            </div>
          ))
        )}
      </section>

      <footer>
        <p>Built with Arc App Kit.</p>
      </footer>
    </main>
  );
}
