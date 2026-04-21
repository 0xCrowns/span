import { NextResponse } from "next/server";
import { getAppKit, createAdapter } from "../../../lib/appKit";

export async function POST(request: Request) {
  const body = await request.json();
  const { fromChain, recipient, amount, token = "USDC" } = body;

  if (!fromChain || !recipient || !amount) {
    return NextResponse.json({ error: "fromChain, recipient, and amount are required." }, { status: 400 });
  }

  const kit = getAppKit();
  const adapter = createAdapter();

  try {
    const result = await (kit as any).send({
      from: { adapter, chain: fromChain },
      to: recipient,
      amount,
      token,
    });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message ?? "Transfer failed." }, { status: 500 });
  }
}
