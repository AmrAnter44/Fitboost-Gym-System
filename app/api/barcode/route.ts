import { NextResponse } from "next/server";
// @ts-ignore
import bwipjs from "bwip-js";

export const dynamic = 'force-dynamic'


export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    const png = await bwipjs.toBuffer({
      bcid: "code128",
      text,
      scale: 5,
      height: 15,
      includetext: true,
      paddingleft: 10,
      paddingright: 10,
      paddingtop: 5,
      paddingbottom: 5,
    });

    const base64 = png.toString("base64");

    return NextResponse.json({ barcode: `data:image/png;base64,${base64}` });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
