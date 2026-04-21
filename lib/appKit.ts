import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";

const kit = new AppKit();

export function getAppKit() {
  return kit;
}

export function createAdapter() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Missing PRIVATE_KEY environment variable.");
  }

  return createViemAdapterFromPrivateKey({ privateKey });
}
