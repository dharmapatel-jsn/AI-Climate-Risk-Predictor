"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { AlertRecord, RiskApiResponse, ZoneRisk } from "@/types/climate";

const RiskMap = dynamic(() => import("@/components/RiskMap"), { ssr: false });

const presets = [
  { label: "Delhi", lat: 28.6139, lon: 77.209 },
  { label: "Lagos", lat: 6.5244, lon: 3.3792 },
  { label: "Jakarta", lat: -6.2088, lon: 106.8456 },
  { label: "Sao Paulo", lat: -23.5505, lon: -46.6333 },
];

function scoreClass(score: number): string {
  if (score >= 0.85) return "text-rose-300";
  if (score >= 0.65) return "text-red-300";
  if (score >= 0.4) return "text-amber-300";
  return "text-emerald-300";
}

export default function DashboardClient() {
  const [coords, setCoords] = useState({ lat: 20.5937, lon: 78.9629 });
  const [zones, setZones] = useState<ZoneRisk[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [zoneQuery, setZoneQuery] = useState("");
  const [zoneKind, setZoneKind] = useState<"all" | "capital" | "major-city">("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 12;

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const riskRes = await fetch(`/api/risk?lat=${coords.lat}&lon=${coords.lon}`, { cache: "no-store" });
        if (!riskRes.ok) throw new Error("Risk API failed");
        const riskData = (await riskRes.json()) as RiskApiResponse;
        setZones(riskData.zones);

        const alertsRes = await fetch("/api/alerts", { cache: "no-store" });
        if (!alertsRes.ok) throw new Error("Alerts API failed");
        const alertsData = (await alertsRes.json()) as { alerts: AlertRecord[] };
        setAlerts(alertsData.alerts);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unexpected error");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [coords.lat, coords.lon]);

  const topRisk = useMemo(() => zones[0], [zones]);
  const filteredZones = useMemo(() => {
    const query = zoneQuery.trim().toLowerCase();

    return zones.filter((zone) => {
      const matchesQuery =
        !query ||
        zone.name.toLowerCase().includes(query) ||
        zone.countryCode.toLowerCase().includes(query);
      const matchesKind = zoneKind === "all" || zone.zoneKind === zoneKind;

      return matchesQuery && matchesKind;
    });
  }, [zoneKind, zoneQuery, zones]);

  const totalPages = Math.max(1, Math.ceil(filteredZones.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleZones = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filteredZones.slice(startIndex, startIndex + pageSize);
  }, [filteredZones, safePage]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <section className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Climate Risk Desk</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Field-Ready Hazard Signals</h1>
          <p className="mt-3 max-w-xl text-sm text-slate-200/80">
            I built this console to turn live weather indicators into actionable flood, heat, and air-risk intelligence for priority zones.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Top Current Risk</p>
          <p className="mt-2 text-lg font-medium text-white">{topRisk?.name ?? "Loading"}</p>
          <p className={`text-2xl font-bold ${topRisk ? scoreClass(topRisk.overallScore) : "text-slate-200"}`}>
            {topRisk ? `${(topRisk.overallScore * 100).toFixed(0)}%` : "-"}
          </p>
          <p className="mt-1 text-xs text-slate-300">{topRisk?.rationale[0] ?? "Calculating risk rationale..."}</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-black/25 p-3 shadow-2xl shadow-cyan-950/30">
          <RiskMap zones={zones} center={[coords.lat, coords.lon]} />
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">Monitoring Anchor</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="rounded-lg border border-white/15 bg-slate-900/40 px-3 py-2 text-left text-sm text-slate-100 transition hover:border-cyan-300/80"
                  onClick={() => setCoords({ lat: preset.lat, lon: preset.lon })}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">Recent Alerts</p>
            <div className="mt-3 space-y-2">
              {alerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="rounded-lg border border-red-200/20 bg-red-950/20 p-2 text-xs text-red-100">
                  <p className="font-medium">{alert.message}</p>
                  <p className="text-red-200/80">{new Date(alert.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {!alerts.length && <p className="text-xs text-slate-300">No high-risk alerts yet.</p>}
            </div>
          </div>
        </aside>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-medium text-white">Zone Risk Table</p>
        {loading && <p className="mt-2 text-sm text-slate-300">Refreshing predictions...</p>}
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        <div className="mt-3 overflow-x-auto">
          <div className="mb-4 grid gap-3 md:grid-cols-[1.5fr_0.7fr_0.6fr]">
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Search zone or country
              <input
                value={zoneQuery}
                onChange={(event) => {
                  setZoneQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Delhi, BR, Lagos..."
                className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-300/70"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Zone type
              <select
                value={zoneKind}
                onChange={(event) => {
                  setZoneKind(event.target.value as typeof zoneKind);
                  setPage(1);
                }}
                className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/70"
              >
                <option value="all">All</option>
                <option value="capital">Capitals</option>
                <option value="major-city">Major cities</option>
              </select>
            </label>
            <div className="flex items-end justify-between gap-2 text-xs text-slate-300 md:justify-end">
              <div>
                {filteredZones.length > 0 ? (
                  <>
                    Showing <span className="text-white">{(safePage - 1) * pageSize + 1}-{Math.min(filteredZones.length, safePage * pageSize)}</span> of <span className="text-white">{filteredZones.length}</span>
                  </>
                ) : (
                  <>
                    Showing <span className="text-white">0</span> of <span className="text-white">0</span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage === 1}
                  className="rounded-md border border-white/10 px-3 py-1.5 text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={safePage === totalPages}
                  className="rounded-md border border-white/10 px-3 py-1.5 text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-slate-300">
                <th className="pb-2">Zone</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Flood</th>
                <th className="pb-2">Heat</th>
                <th className="pb-2">Air</th>
                <th className="pb-2">Overall</th>
              </tr>
            </thead>
            <tbody>
              {visibleZones.map((zone) => (
                <tr key={zone.id} className="border-t border-white/10 text-slate-100">
                  <td className="py-2">
                    <div className="font-medium text-white">{zone.name}</div>
                    <div className="text-xs text-slate-400">{zone.countryCode} · {zone.populationEstimate.toLocaleString()}</div>
                  </td>
                  <td className="py-2 text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                    {zone.zoneKind === "capital" ? "Capital" : zone.zoneKind === "major-city" ? "Major city" : "Zone"}
                  </td>
                  <td>{(zone.risks.flood * 100).toFixed(0)}%</td>
                  <td>{(zone.risks.heatwave * 100).toFixed(0)}%</td>
                  <td>{(zone.risks.airQuality * 100).toFixed(0)}%</td>
                  <td className={scoreClass(zone.overallScore)}>{(zone.overallScore * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
            <p>
              Page <span className="text-white">{safePage}</span> of <span className="text-white">{totalPages}</span>
            </p>
            {!visibleZones.length && <p className="text-sm text-slate-300">No zones match the current filter.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
