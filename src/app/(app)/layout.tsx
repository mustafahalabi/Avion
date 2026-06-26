import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/nav/sidebar";
import { UserMenu } from "@/components/nav/user-menu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950 text-neutral-100">
      {/* Sidebar */}
      <div className="relative flex flex-col">
        <Sidebar />
        {/* User menu anchored to sidebar bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-12 border-t border-neutral-800 flex items-center px-2">
          <UserMenu user={session.user} />
        </div>
      </div>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
