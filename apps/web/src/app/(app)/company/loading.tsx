export default function CompanyLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center border-b border-neutral-800 px-6">
        <div className="h-4 w-20 animate-pulse rounded bg-neutral-800" />
      </header>
      <div className="flex flex-col gap-2 p-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
          >
            <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-800" />
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-32 animate-pulse rounded bg-neutral-800" />
              <div className="h-2.5 w-20 animate-pulse rounded bg-neutral-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
