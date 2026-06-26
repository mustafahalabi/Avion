import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NewReleaseForm } from "./new-release-form";

export default async function NewReleasePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/work/releases"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Releases
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-semibold text-neutral-100">New release</h1>
      </header>

      <div className="p-6 max-w-lg">
        <NewReleaseForm />
      </div>
    </div>
  );
}
