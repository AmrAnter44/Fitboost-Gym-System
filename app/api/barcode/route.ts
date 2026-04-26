import { NextResponse } from "next/server";
// @ts-ignore
import bwipjs from "bwip-js";

export const dynamic = 'force-dynamic'


export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    // 🔢 لو الرقم أقل من ٤ خانات، حشّيه بمسافات قبله عشان يبقى ٤ على الأقل
    //    (مثلاً "22" → "  22") — بس على الباركود (الـ scanner بيقرا الـ raw value)
    const rawText = String(text ?? '');
    const paddedText = rawText.length < 4 ? rawText.padStart(4, ' ') : rawText;

    const png = await bwipjs.toBuffer({
      bcid: "code128",
      text: paddedText,
      scale: 5,
      height: 15,
      includetext: true,
      paddingleft: 10,
      paddingright: 10,
      paddingtop: 5,
      paddingbottom: 5,
      backgroundcolor: "FFFFFF",
      barcolor: "000000",
    });

    const base64 = png.toString("base64");

    return NextResponse.json({ barcode: `data:image/png;base64,${base64}` });
  } catch (error) {
    console.error('Barcode generation error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
