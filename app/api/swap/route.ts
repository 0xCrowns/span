import { NextResponse } from "next/server";
import { getAppKit, createAdapter } from "../../../lib/appKit";

export async function POST(request: Request) {
  const body = await request.json();
  const { fromChain, amount, sourceToken, destinationToken, slippageBps = 300 } = body;

  if (!fromChain || !amount || !sourceToken || !destinationToken) {
    return NextResponse.json({ error: "fromChain, amount, sourceToken, and destinationToken are required." }, { status: 400 });
  }

  const kit = getAppKit();
  const adapter = createAdapter();
  const kitKey = process.env.APP_KIT_KEY;

  try {
    const kitAny = kit as any;
    if (typeof kitAny.swap !== "function") {
      throw new Error("App Kit swap method is not available in this package version.");
    }

    const result = await kitAny.swap({
      from: { adapter, chain: fromChain },
      tokenIn: sourceToken,
      tokenOut: destinationToken,
      amountIn: amount,
      config: {
        slippageBps: Number(slippageBps),
        kitKey: kitKey || undefined,
      },
    });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message ?? "Swap failed." }, { status: 500 });
  }
}
