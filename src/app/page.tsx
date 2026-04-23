import DashboardClient from "@/components/DashboardClient";

export default function Home() {
  return (
    <main className="min-h-screen bg-climate text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(14,165,233,0.35),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.25),transparent_32%),radial-gradient(circle_at_70%_80%,rgba(239,68,68,0.2),transparent_30%)]" />
      <DashboardClient />
    </main>
  );
}
