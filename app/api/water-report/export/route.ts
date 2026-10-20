import {requireSession} from "@/lib/auth/server";
import {exportReport} from "@/lib/report-exports/water";
export async function GET(request: Request) {
 const session = await requireSession(); if (!session.ok) return session.response;
 return exportReport(request);
}
