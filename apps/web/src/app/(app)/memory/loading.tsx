export default function MemoryLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center border-b border-neutral-800 px-6">
        <div className="h-4 w-16 animate-pulse rounded bg-neutral-800" />
      </header>
      <div className="grid grid-cols-2 gap-4 p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
          >
            <div className="mb-3 h-3 w-32 animate-pulse rounded bg-neutral-800" />
            <div className="flex flex-col gap-1.5">
              <div className="h-2.5 w-full animate-pulse rounded bg-neutral-800" />
              <div className="h-2.5 w-4/5 animate-pulse rounded bg-neutral-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
