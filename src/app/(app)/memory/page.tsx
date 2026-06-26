import { BookOpen } from "lucide-react";

export default function MemoryPage() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center border-b border-neutral-800 px-6">
        <h1 className="text-sm font-semibold text-neutral-100">Memory</h1>
      </header>

      <div className="flex flex-1 items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900">
            <BookOpen className="h-5 w-5 text-neutral-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-300">
              Organizational Memory
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              Architecture decisions, coding standards, and feature history will
              accumulate here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
