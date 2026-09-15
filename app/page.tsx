import { DailyProductionTable } from "@/components/daily-production-table";
import { AppShell } from "@/components/app-shell";

export default function Home() {
  return <AppShell active="data"><DailyProductionTable /></AppShell>;
}
