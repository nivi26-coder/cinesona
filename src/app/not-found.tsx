import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Movie not found</h1>
      <p className="text-sm text-muted">That page doesn’t exist, or the movie was removed.</p>
      <Link href="/" className="text-sm font-medium text-accent hover:underline">
        ← Back to all movies
      </Link>
    </div>
  );
}
