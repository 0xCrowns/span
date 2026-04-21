"use client";

import { useEffect, useRef, useState } from "react";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

type Action = "bridge" | "transfer" | "swap";

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

const supportedTokens = ["USDC", "USDT", "NATIVE", "DAI", "ETH"];

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
  const [status, setStatus] = useState<Status>({
    loading: false,
    message: "Ready to execute a swap, bridge, or transfer.",
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
    setStatus({ loading: true, message: "Connecting browser wallet..." });

    try {
      const anyWindow = window as any;
      const provider = anyWindow.ethereum;

      if (!provider) {
        throw new Error("No browser wallet detected. Install MetaMask or another EIP-1193 wallet.");
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
      setStatus({ loading: false, message: "Browser wallet connected successfully." });
    } catch (error: unknown) {
      setWalletConnected(false);
      setStatus({ loading: false, message: "Wallet connection failed." });
      setWalletError(error instanceof Error ? error.message : "Failed to connect browser wallet.");
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
          from: { adapter: adapterRef.current, chain: payload.fromChain },
          tokenIn: payload.sourceToken,
          tokenOut: payload.destinationToken,
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

  return (
    <main>
      <header>
        <h1>span</h1>
        <p>
          A Web3 swap, bridge, and transfer dashboard built with Arc App Kit.
          Connect a browser wallet, or use the server-side fallback when no wallet is available.
        </p>
      </header>

      <section>
        <fieldset>
          <legend>Wallet status</legend>
          <p>{walletConnected ? `Connected: ${walletAddress}` : "No browser wallet connected."}</p>
          <p>{walletChain ? `Network: ${walletChain}` : "Network unknown."}</p>
          <p>{appKitQuoteKey ? "App Kit quote key configured." : "App Kit quote key not set."}</p>
          <button disabled={status.loading} onClick={connectWallet}>
            {walletConnected ? "Reconnect Wallet" : "Connect Browser Wallet"}
          </button>
          {walletError ? <p className="status">{walletError}</p> : null}
        </fieldset>
      </section>

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

      <section>
        <h2>Action status</h2>
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
          <p>No actions yet. Execute a bridge, transfer, or swap to populate history.</p>
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
        <p>
          Built for Arc App Kit. Use a browser wallet for native flows, or configure a
          server-side `PRIVATE_KEY` fallback in `.env.local`.
        </p>
      </footer>
    </main>
  );
}
