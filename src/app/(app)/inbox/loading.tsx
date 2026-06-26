export default function InboxLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center border-b border-neutral-800 px-6">
        <div className="h-4 w-12 animate-pulse rounded bg-neutral-800" />
      </header>
      <div className="flex flex-col gap-px p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg px-3 py-3"
          >
            <div className="mt-0.5 h-2 w-2 animate-pulse rounded-full bg-neutral-700" />
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-56 animate-pulse rounded bg-neutral-800" />
              <div className="h-2.5 w-36 animate-pulse rounded bg-neutral-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
