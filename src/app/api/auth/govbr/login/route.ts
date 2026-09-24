import { NextResponse } from "next/server";
import { govbrLoginUrl } from "@/lib/govbr";

export async function GET() {
  const state = Math.random().toString(36).slice(2);
  return NextResponse.redirect(govbrLoginUrl(state));
}
