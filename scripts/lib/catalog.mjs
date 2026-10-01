// Shared helpers for the import scripts that fill the `titles` collection.
import { MongoClient } from "mongodb";

export async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Add it to .env.local first.");
    process.exit(1);
  }
  // ignoreUndefined: optional fields that are missing stay missing instead of
  // being stored as null.
  const client = new MongoClient(uri, { appName: "cinesona-import", ignoreUndefined: true });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB ?? "cinesona");
  return { client, db, titles: db.collection("titles") };
}

export function slugify(text) {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return slug || "title";
}

// Used to spot the same film arriving from two sources.
export const titleKey = (title, year) => `${slugify(title)}|${year ?? ""}`;

export function* chunks(items, size) {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

const get = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);

/**
 * Inserts new titles and refreshes existing ones, matched on `keyPath`
 * (e.g. "ext.tmdbTv"). Each doc carries `slugBase` and `slugSuffix`: a new
 * title gets `slugBase` as its URL slug, or `slugBase-slugSuffix` if another
 * title of the same kind already has it. Existing titles keep their slug, so
 * URLs never change on a re-import.
 */
export async function upsertTitles(titles, docs, keyPath) {
  const now = new Date();
  let inserted = 0;
  let updated = 0;

  // API pages can repeat an item when rankings shift mid-import.
  const unique = [...new Map(docs.map((d) => [String(get(d, keyPath)), d])).values()];

  for (const batch of chunks(unique, 500)) {
    const existing = await titles
      .find({ [keyPath]: { $in: batch.map((d) => get(d, keyPath)) } }, { projection: { [keyPath]: 1 } })
      .toArray();
    const known = new Set(existing.map((e) => String(get(e, keyPath))));

    const fresh = batch.filter((d) => !known.has(String(get(d, keyPath))));
    const takenDocs = await titles
      .find(
        { slug: { $in: fresh.flatMap((d) => [d.slugBase, `${d.slugBase}-${d.slugSuffix}`]) } },
        { projection: { kind: 1, slug: 1 } },
      )
      .toArray();
    const taken = new Set(takenDocs.map((t) => `${t.kind}/${t.slug}`));

    const ops = batch.map((doc) => {
      const { slugBase, slugSuffix, ext, ...fields } = doc;
      const set = { ...fields, updatedAt: now };
      // Set ext.* one by one so IDs added by another importer survive.
      for (const [k, v] of Object.entries(ext)) if (v !== undefined) set[`ext.${k}`] = v;

      const update = { $set: set };
      if (!known.has(String(get(doc, keyPath)))) {
        let slug = slugBase;
        for (let n = 1; taken.has(`${doc.kind}/${slug}`); n++) {
          slug = n === 1 ? `${slugBase}-${slugSuffix}` : `${slugBase}-${slugSuffix}-${n}`;
        }
        taken.add(`${doc.kind}/${slug}`);
        update.$setOnInsert = { slug, popularity: 0 };
      }
      return { updateOne: { filter: { [keyPath]: get(doc, keyPath) }, update, upsert: true } };
    });

    const result = await titles.bulkWrite(ops, { ordered: false });
    inserted += result.upsertedCount;
    updated += result.modifiedCount;
  }
  return { inserted, updated };
}

/**
 * `popularity` is a 0–1 rank within each kind + source (1 = most votes).
 * Raw vote counts aren't comparable across sources (IMDb has millions,
 * IGDB hundreds), so a percentile lets the "All" tab mix kinds fairly.
 */
export async function recomputePopularity(titles) {
  const groups = await titles.aggregate([{ $group: { _id: { kind: "$kind", source: "$source" } } }]).toArray();
  for (const { _id: group } of groups) {
    const ids = await titles
      .find(group, { projection: { _id: 1 } })
      .sort({ votes: -1, _id: 1 })
      .toArray();
    const n = ids.length;
    const ops = ids.map((d, i) => ({
      updateOne: { filter: { _id: d._id }, update: { $set: { popularity: n === 1 ? 1 : 1 - i / (n - 1) } } },
    }));
    for (const batch of chunks(ops, 1000)) await titles.bulkWrite(batch, { ordered: false });
    console.log(`  popularity: ${group.kind}/${group.source} (${n})`);
  }
}
