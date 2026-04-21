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

  if (!kitKey) {
    return NextResponse.json({ error: "APP_KIT_KEY must be set to use server-side swap quotes." }, { status: 400 });
  }

  try {
    const result = await (kit as any).estimateSwap({
      from: { adapter, chain: fromChain },
      tokenIn: sourceToken,
      tokenOut: destinationToken,
      amountIn: amount,
      config: {
        slippageBps: Number(slippageBps),
        kitKey,
      },
    });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message ?? "Quote request failed." }, { status: 500 });
  }
}
