import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NewMemoryForm } from "./new-memory-form";

export default async function NewMemoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/memory"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Memory
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-semibold text-neutral-100">New Memory</h1>
      </header>

      <div className="flex flex-col gap-6 p-6 max-w-lg">
        <div>
          <h2 className="text-base font-semibold text-neutral-100">
            Create a memory bank
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Memory banks store durable knowledge about your company, systems,
            and decisions.
          </p>
        </div>
        <NewMemoryForm />
      </div>
    </div>
  );
}
