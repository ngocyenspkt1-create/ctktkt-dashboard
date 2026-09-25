import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { ChangePasswordForm } from "@/components/change-password-form";
import { getSessionUserForPasswordChange } from "@/lib/auth/server";

export default async function ChangePasswordPage() {
  const user = await getSessionUserForPasswordChange();
  if (!user) redirect("/login");

  return (
    <AuthLayout>
      <ChangePasswordForm displayName={user.displayName} required={Boolean(user.mustChangePassword)} />
    </AuthLayout>
  );
}
