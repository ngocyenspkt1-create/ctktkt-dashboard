import type { SessionUser } from "./auth/session";
import type { WorkItem, WorkMember } from "./work-px";
export const workPreviewUser: SessionUser = { id: 1, username: "demo", displayName: "Lãnh đạo minh họa", role: "viewer", permissions: ["work_px", "manage_work_px"] };
const members: WorkMember[] = [{ id: 1, displayName: "Lãnh đạo minh họa", position: "Lãnh đạo PX" }, { id: 2, displayName: "Cá nhân minh họa A", position: "Kỹ thuật viên" }, { id: 3, displayName: "Cá nhân minh họa B", position: "Trưởng ca" }];
const base: WorkItem = { id: "demo", version: 1, kind: "task", sourceType: "meeting", title: "", description: "Nội dung minh họa để kiểm tra giao diện; không phải phân công vận hành thực tế.", sourceDate: "2026-10-01", sourceId: null, creatorId: 1, creatorName: "Lãnh đạo minh họa", assigneeId: 2, collaboratorIds: [3], startDate: "2026-10-01", dueDate: "2026-10-31", reportEveryDays: 7, lastReportDate: "2026-10-08", status: "in_progress", progress: 40, priority: "normal", createdAt: "2026-10-01T01:00:00Z", updatedAt: "2026-10-08T02:00:00Z" };
export const workPreviewData = { today: "2026-10-13", members, items: [
  { ...base, id: "demo-1", title: "Rà soát các tồn tại sau họp giao ban kỹ thuật", priority: "high", progress: 65 },
  { ...base, id: "demo-2", title: "Tổng hợp tình hình thực hiện công việc tháng 10", status: "assigned", progress: 0, lastReportDate: null },
  { ...base, id: "demo-3", title: "Cập nhật danh mục theo dõi khắc phục khiếm khuyết", dueDate: "2026-10-10", lastReportDate: "2026-10-05", priority: "high", progress: 80 },
  { ...base, id: "demo-4", title: "Rà soát tài liệu huấn luyện và quy trình vận hành", status: "pending_review", progress: 100 },
  { ...base, id: "demo-5", title: "Hoàn thiện báo cáo tổng kết công việc chuyển tiếp", startDate: "2026-09-24", status: "completed", progress: 100 },
  { ...base, id: "demo-6", kind: "source", title: "Kết luận họp giao ban PXVH1 ngày 12/10", sourceDate: "2026-10-12", status: "submitted", assigneeId: null, collaboratorIds: [], progress: 0 },
] as WorkItem[] };
