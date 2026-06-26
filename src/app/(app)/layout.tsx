import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { Sidebar } from "@/components/nav/sidebar";
import { UserMenu } from "@/components/nav/user-menu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <div className="relative flex flex-col">
        <Sidebar />
        <div className="absolute bottom-0 left-0 right-0 h-12 border-t border-neutral-800 flex items-center px-2">
          <UserMenu user={user} />
        </div>
      </div>

      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
