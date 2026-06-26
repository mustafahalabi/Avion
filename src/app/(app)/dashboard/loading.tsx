export default function DashboardLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center border-b border-neutral-800 px-6">
        <div className="h-4 w-20 animate-pulse rounded bg-neutral-800" />
      </header>
      <div className="grid grid-cols-3 gap-4 p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900"
          />
        ))}
      </div>
    </div>
  );
}
