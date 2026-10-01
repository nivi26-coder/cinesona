"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted">
        We couldn’t load movies right now. If you’re running locally, check that your IP address is allowed in
        Atlas → Network Access.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
