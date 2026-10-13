import { notFound } from "next/navigation";
import { WorkPxWorkspace } from "@/components/work-px-client";
import { workPreviewData, workPreviewUser } from "@/lib/work-px-preview";
export const dynamic = "force-dynamic";
export default function WorkPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main style={{ background: "#eef3f8", minHeight: "100vh" }}><WorkPxWorkspace user={workPreviewUser} preview={workPreviewData} /></main>;
}
