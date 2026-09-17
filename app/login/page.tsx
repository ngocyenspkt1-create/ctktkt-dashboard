import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f6f8] p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
