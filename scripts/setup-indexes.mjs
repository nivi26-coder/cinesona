// Creates the indexes Cinesona needs. Safe to run more than once.
// Usage: npm run db:indexes   (reads MONGODB_URI from .env.local)
import { connect } from "./lib/catalog.mjs";

const { client, db, titles } = await connect();

try {
  const mflix = client.db(process.env.MFLIX_DB ?? "sample_mflix");

  // The detail page lists newest comments for one sample_mflix movie.
  await mflix.collection("comments").createIndex({ movie_id: 1, date: -1 });
  console.log("✓ sample_mflix.comments { movie_id, date }");

  if (!(await db.listCollections({ name: "titles" }).hasNext())) await db.createCollection("titles");

  // Slugs are unique per kind (/movies/x and /games/x can coexist), and each
  // source ID appears at most once.
  const once = (field) => ({ unique: true, partialFilterExpression: { [field]: { $exists: true } } });
  await titles.createIndexes([
    { key: { kind: 1, slug: 1 }, unique: true },
    { key: { "ext.mflix": 1 }, ...once("ext.mflix") },
    { key: { "ext.tmdbMovie": 1 }, ...once("ext.tmdbMovie") },
    { key: { "ext.tmdbTv": 1 }, ...once("ext.tmdbTv") },
    { key: { "ext.igdb": 1 }, ...once("ext.igdb") },
    { key: { popularity: -1 } },
    { key: { kind: 1, popularity: -1 } },
    { key: { kind: 1, genres: 1, popularity: -1 } },
  ]);
  console.log("✓ titles indexes");

  // Atlas M0 allows only 3 search/vector indexes in total. The Week 1 index on
  // sample_mflix.movies is replaced by titles_search.
  const movies = mflix.collection("movies");
  if (await movies.listSearchIndexes("movies_search").hasNext()) {
    await movies.dropSearchIndex("movies_search");
    console.log("- dropped old movies_search index");
  }

  const name = "titles_search";
  const [existing] = await titles.listSearchIndexes(name).toArray();
  if (existing) {
    console.log(`✓ ${name} search index already exists (status: ${existing.status})`);
  } else {
    await titles.createSearchIndex({
      name,
      definition: {
        mappings: {
          dynamic: false,
          fields: {
            title: [
              { type: "autocomplete", tokenization: "edgeGram", minGrams: 2, maxGrams: 15, foldDiacritics: true },
              { type: "string" },
            ],
            originalTitle: { type: "string" },
            synopsis: { type: "string" },
            cast: { type: "string" },
            directors: { type: "string" },
            companies: { type: "string" },
            kind: { type: "token" },
            genres: { type: "token" },
            popularity: { type: "number" },
          },
        },
      },
    });
    console.log(`+ created ${name} search index. Atlas needs a minute or two to build it.`);
  }
} finally {
  await client.close();
}
