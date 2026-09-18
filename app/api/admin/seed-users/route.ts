import { getRawDb } from "@/db";
import { requireAdmin } from "@/lib/auth/server";
import { seedUsersAndPositions } from "@/lib/auth/initial-users-data";

export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const result = await seedUsersAndPositions(getRawDb());
    return Response.json({
      ok: true,
      message: `Đã đồng bộ thành công ${result.usersSeeded}/${result.totalUsers} nhân sự và ${result.positionsSeeded}/${result.totalPositions} cương vị.`,
      result,
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Lỗi khi đồng bộ danh sách nhân sự.",
    }, { status: 500 });
  }
}

