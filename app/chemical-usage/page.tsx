import { AppShell } from "@/components/app-shell";
import { ChemicalUsageClient } from "@/components/chemical-usage-client";

export default function ChemicalUsagePage() {
  return (
    <AppShell active="chemical-usage">
      <ChemicalUsageClient />
    </AppShell>
  );
}
