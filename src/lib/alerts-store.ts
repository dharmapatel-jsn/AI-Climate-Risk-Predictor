import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { AlertRecord } from "@/types/climate";

const alertsFilePath = path.join(process.cwd(), "data", "alerts.json");

async function ensureStore(): Promise<void> {
  await mkdir(path.dirname(alertsFilePath), { recursive: true });
  try {
    await readFile(alertsFilePath, "utf8");
  } catch {
    await writeFile(alertsFilePath, "[]\n", "utf8");
  }
}

export async function readAlerts(): Promise<AlertRecord[]> {
  await ensureStore();
  const content = await readFile(alertsFilePath, "utf8");
  return JSON.parse(content) as AlertRecord[];
}

export async function appendAlerts(records: Omit<AlertRecord, "id" | "createdAt">[]): Promise<AlertRecord[]> {
  if (records.length === 0) return [];

  const existing = await readAlerts();
  const created = records.map((record) => ({
    ...record,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }));

  const merged = [...created, ...existing].slice(0, 500);
  await writeFile(alertsFilePath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  return created;
}
