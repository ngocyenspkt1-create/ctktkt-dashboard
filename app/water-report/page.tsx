import { AppShell } from "@/components/app-shell";
import { WaterReportClient } from "@/components/water-report-client";

export default function WaterReportPage() {
  return (
    <AppShell active="water" hideSearch>
      <WaterReportClient />
    </AppShell>
  );
}

