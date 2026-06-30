import { getCurrentUser } from "@/lib/current-user";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NewWorkspaceForm } from "./new-workspace-form";

export default async function NewWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/work/workspaces"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Workspaces
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-semibold text-neutral-100">New Workspace</h1>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h2 className="text-base font-semibold text-neutral-100">
            Create a workspace
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            A workspace groups related repositories and projects — e.g. a
            product, system, or area of the company.
          </p>
        </div>
        <NewWorkspaceForm />
      </div>
    </div>
  );
}
