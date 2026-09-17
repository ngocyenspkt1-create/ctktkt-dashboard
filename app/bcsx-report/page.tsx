import { AppShell } from "@/components/app-shell";
import { BcsxReport } from "@/components/bcsx-report";

export default function BcsxReportPage() {
  return <AppShell active="bcsx" hideSearch><BcsxReport /></AppShell>;
}
