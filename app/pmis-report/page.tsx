import { AppShell } from "@/components/app-shell";
import { PmisReport } from "@/components/pmis-report";

export default function PmisReportPage() {
  return <AppShell active="pmis" hideSearch><PmisReport /></AppShell>;
}
