import { NextResponse } from "next/server";
import { getAppKit, createAdapter } from "../../../lib/appKit";

export async function POST(request: Request) {
  const body = await request.json();
  const { fromChain, toChain, amount, token = "USDC" } = body;

  if (!fromChain || !toChain || !amount) {
    return NextResponse.json({ error: "fromChain, toChain, and amount are required." }, { status: 400 });
  }

  const kit = getAppKit();
  const adapter = createAdapter();

  try {
    const result = await (kit as any).bridge({
      from: { adapter, chain: fromChain },
      to: { adapter, chain: toChain },
      amount,
      token,
    });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message ?? "Bridge failed." }, { status: 500 });
  }
}
