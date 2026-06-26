export default function WorkLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center border-b border-neutral-800 px-6">
        <div className="h-4 w-12 animate-pulse rounded bg-neutral-800" />
      </header>
      <div className="flex flex-col gap-3 p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
          >
            <div className="mb-2 h-3 w-48 animate-pulse rounded bg-neutral-800" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-neutral-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
