import Link from "next/link";
import { KIND_INFO, titleHref } from "@/lib/kinds";
import type { TitleCard as TitleCardData } from "@/lib/titles";
import { Poster } from "./Poster";
import { RatingBadge } from "./RatingBadge";

export function TitleCard({
  title,
  priority,
  showKind,
}: {
  title: TitleCardData;
  priority?: boolean;
  /** Label the kind on mixed lists (the "All" tab). */
  showKind?: boolean;
}) {
  return (
    <Link
      href={titleHref(title)}
      className="group flex flex-col gap-2 rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface-2 transition-transform group-hover:-translate-y-0.5">
        <Poster
          src={title.poster}
          title={title.title}
          sizes="(min-width: 1280px) 180px, (min-width: 640px) 25vw, 45vw"
          priority={priority}
        />
        {title.rating !== undefined && <RatingBadge rating={title.rating} className="absolute right-2 top-2" />}
        {showKind && (
          <span className="absolute left-2 top-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            {KIND_INFO[title.kind].label}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-medium group-hover:text-accent">{title.title}</h3>
        <p className="truncate text-xs text-muted">
          {[title.year, title.genres.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}
