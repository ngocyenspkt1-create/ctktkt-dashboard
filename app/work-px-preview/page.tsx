import { notFound } from "next/navigation";
import { WorkPxWorkspace } from "@/components/work-px-client";
import { workPreviewData, workPreviewUser } from "@/lib/work-px-preview";
import { ThemeToggle } from "@/components/theme-toggle";
export const dynamic = "force-dynamic";
export default function WorkPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main style={{ background: "var(--background)", minHeight: "100vh" }}><div className="flex justify-end p-3"><ThemeToggle /></div><WorkPxWorkspace user={workPreviewUser} preview={workPreviewData} /></main>;
}
