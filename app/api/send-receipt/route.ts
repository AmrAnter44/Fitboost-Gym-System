// app/api/send-receipt/route.ts
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic'


export async function POST(req: Request) {
  try {
    const { phone, message } = await req.json();

    // هنا ممكن تضيف أي Integration مع خدمة WhatsApp رسمية أو خارجيّة

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
