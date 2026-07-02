import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-4xl font-bold text-neutral-700">404</p>
        <div>
          <p className="text-sm font-medium text-neutral-300">
            Page not found
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            The page you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
