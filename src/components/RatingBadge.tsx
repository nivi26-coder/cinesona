export function RatingBadge({ rating, className = "" }: { rating: number; className?: string }) {
  return (
    <span
      className={`rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-semibold text-amber-400 backdrop-blur ${className}`}
    >
      <span aria-hidden>★</span> {rating.toFixed(1)}
      <span className="sr-only"> out of 10</span>
    </span>
  );
}
