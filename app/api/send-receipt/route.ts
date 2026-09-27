// app/api/send-receipt/route.ts
import { NextResponse } from "next/server";
import { guard } from '../../../lib/routeGuard'

export const dynamic = 'force-dynamic'


export async function POST(req: Request) {
  const __g = await guard(req, ['canSendWhatsApp'])
  if (__g instanceof NextResponse) return __g

  try {
    const { phone, message } = await req.json();

    // هنا ممكن تضيف أي Integration مع خدمة WhatsApp رسمية أو خارجيّة

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
