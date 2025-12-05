import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/sonner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth0のセッションを確認
  const session = await auth0.getSession();

  if (!session) {
    redirect("/login");
  }

  // Auth0ユーザー情報をSupabase形式に変換
  const user = {
    id: session.user.sub,
    email: session.user.email,
    user_metadata: {
      full_name: session.user.name,
      avatar_url: session.user.picture,
    },
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar user={user} />
      <main className="flex-1 p-4 md:p-6 pt-16 md:pt-6">{children}</main>
      <Toaster />
    </div>
  );
}
