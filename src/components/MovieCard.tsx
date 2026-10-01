import Link from "next/link";
import type { MovieCard as MovieCardData } from "@/lib/movies";
import { Poster } from "./Poster";
import { RatingBadge } from "./RatingBadge";

export function MovieCard({ movie, priority }: { movie: MovieCardData; priority?: boolean }) {
  return (
    <Link
      href={`/movies/${movie.id}`}
      className="group flex flex-col gap-2 rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface-2 transition-transform group-hover:-translate-y-0.5">
        <Poster
          src={movie.poster}
          title={movie.title}
          sizes="(min-width: 1280px) 180px, (min-width: 640px) 25vw, 45vw"
          priority={priority}
        />
        {movie.rating !== undefined && (
          <RatingBadge rating={movie.rating} className="absolute right-2 top-2" />
        )}
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-medium group-hover:text-accent">{movie.title}</h3>
        <p className="truncate text-xs text-muted">
          {[movie.year, movie.genres.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}
