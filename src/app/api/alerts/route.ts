import { NextResponse } from "next/server";
import { readAlerts } from "@/lib/alerts-store";

export async function GET() {
  const alerts = await readAlerts();
  return NextResponse.json({ alerts: alerts.slice(0, 100) });
}
