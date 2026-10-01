// Copies sample_mflix.movies into the cinesona `titles` collection.
// Safe to re-run: titles are matched on their sample_mflix _id.
// Usage: npm run import:mflix
import { connect, recomputePopularity, slugify, upsertTitles } from "./lib/catalog.mjs";

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
// A few years are strings like "2007è"; keep the leading number.
const toYear = (v) => num(v) ?? (Number.parseInt(String(v), 10) || undefined);

const { client, titles } = await connect();
try {
  const movies = client.db(process.env.MFLIX_DB ?? "sample_mflix").collection("movies");

  // sample_mflix lists ~680 films twice (same title, year and director, slightly
  // different vote counts). Keep the most-voted copy; remember the others so
  // their old URLs redirect and their comments still show.
  const groups = new Map();
  for await (const m of movies.find().sort({ _id: 1 })) {
    const key = [slugify(m.title), toYear(m.year), m.type, m.directors?.[0]].join("|");
    const group = groups.get(key);
    if (group) group.push(m);
    else groups.set(key, [m]);
  }

  const docs = [];
  const duplicateIds = [];
  for (const group of groups.values()) {
    group.sort((a, b) => (num(b.imdb?.votes) ?? 0) - (num(a.imdb?.votes) ?? 0));
    const [m, ...copies] = group;
    duplicateIds.push(...copies.map((c) => c._id));

    const year = toYear(m.year);
    const genres = m.genres ?? [];
    const kind =
      m.type === "series"
        ? "series"
        : genres.includes("Animation") && m.countries?.includes("Japan")
          ? "anime"
          : "movie";
    const rating = num(m.imdb?.rating);

    docs.push({
      kind,
      title: m.title,
      year,
      synopsis: m.fullplot ?? m.plot,
      genres,
      poster: m.poster,
      score: rating !== undefined ? Math.round(rating * 10) : undefined,
      scoreSource: "IMDb",
      votes: num(m.imdb?.votes),
      runtime: num(m.runtime),
      rated: m.rated,
      directors: m.directors,
      writers: m.writers,
      cast: m.cast,
      languages: m.languages,
      countries: m.countries,
      awards: m.awards?.text,
      tomatoesCritic: num(m.tomatoes?.critic?.rating),
      tomatoesViewer: num(m.tomatoes?.viewer?.rating),
      ext: {
        mflix: m._id,
        mflixCopies: copies.length > 0 ? copies.map((c) => c._id) : undefined,
        imdb: num(m.imdb?.id) ? `tt${String(m.imdb.id).padStart(7, "0")}` : undefined,
      },
      source: "mflix",
      slugBase: slugify(year ? `${m.title} ${year}` : m.title),
      slugSuffix: m._id.toHexString().slice(-6),
    });
  }

  // An earlier run may have imported the duplicate copies as separate titles.
  const { deletedCount } = await titles.deleteMany({ source: "mflix", "ext.mflix": { $in: duplicateIds } });
  if (deletedCount) console.log(`- removed ${deletedCount} duplicate copies from a previous run`);

  const { inserted, updated } = await upsertTitles(titles, docs, "ext.mflix");
  console.log(`✓ sample_mflix: ${docs.length} titles (${duplicateIds.length} duplicates merged), ${inserted} new, ${updated} updated`);

  // A removed copy may have held the plain slug (e.g. "the-shawshank-redemption-1994");
  // give it to the copy we kept, which got a suffixed slug.
  const taken = new Set();
  for await (const t of titles.find({}, { projection: { kind: 1, slug: 1 } })) taken.add(`${t.kind}/${t.slug}`);
  let renamed = 0;
  for (const doc of docs) {
    if (taken.has(`${doc.kind}/${doc.slugBase}`)) continue;
    await titles.updateOne({ "ext.mflix": doc.ext.mflix }, { $set: { slug: doc.slugBase } });
    taken.add(`${doc.kind}/${doc.slugBase}`);
    renamed++;
  }
  if (renamed) console.log(`✓ ${renamed} titles moved to their plain slug`);

  await recomputePopularity(titles);
} finally {
  await client.close();
}
