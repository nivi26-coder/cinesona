"use client";

import Image from "next/image";
import { useState } from "react";

// Many poster URLs in sample_mflix are dead, so fall back to a title tile.
export function Poster({
  src,
  title,
  sizes,
  priority,
}: {
  src?: string;
  title: string;
  sizes: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-surface-2 p-3 text-center text-sm font-medium text-muted">
        {title}
      </div>
    );
  }

  return (
    <Image
      src={src}
      // The title is always shown next to the poster, so it's decorative here.
      alt=""
      fill
      sizes={sizes}
      priority={priority}
      // Posters are already small JPEGs; skipping optimization keeps us well
      // inside the Vercel Hobby image-optimization quota.
      unoptimized
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}
