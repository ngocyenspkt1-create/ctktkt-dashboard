import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/change-password-form";
import { getSessionUserForPasswordChange } from "@/lib/auth/server";

export default async function ChangePasswordPage() {
  const user = await getSessionUserForPasswordChange();
  if (!user) redirect("/login");

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f6f8] p-4">
      <ChangePasswordForm displayName={user.displayName} required={Boolean(user.mustChangePassword)} />
    </main>
  );
}
