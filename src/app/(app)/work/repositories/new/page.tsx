import { getCurrentUser } from "@/lib/current-user";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AddRepositoryForm } from "./add-repository-form";

export default async function NewRepositoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/work/repositories"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Repositories
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-semibold text-neutral-100">
          Add Repository
        </h1>
      </header>

      <div className="flex flex-col gap-6 p-6 max-w-lg">
        <div>
          <h2 className="text-base font-semibold text-neutral-100">
            Connect a repository
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Add your codebase so Engineering OS can understand your technology
            stack and support planning.
          </p>
        </div>
        <AddRepositoryForm />
      </div>
    </div>
  );
}
