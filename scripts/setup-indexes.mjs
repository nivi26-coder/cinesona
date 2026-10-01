// Creates the indexes Cinesona needs. Safe to run more than once.
// Usage: npm run db:indexes   (reads MONGODB_URI from .env.local)
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set. Add it to .env.local first.");
  process.exit(1);
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB ?? "sample_mflix");

  // Regular index: the movie page lists newest comments for one movie.
  await db.collection("comments").createIndex({ movie_id: 1, date: -1 });
  console.log("✓ comments { movie_id, date } index");

  // Atlas Search index (free tier allows 3): autocomplete on titles plus
  // full-text over plot, cast and directors.
  const movies = db.collection("movies");
  const name = "movies_search";
  const [existing] = await movies.listSearchIndexes(name).toArray();
  if (existing) {
    console.log(`✓ ${name} search index already exists (status: ${existing.status})`);
  } else {
    await movies.createSearchIndex({
      name,
      definition: {
        mappings: {
          dynamic: false,
          fields: {
            title: [
              { type: "autocomplete", tokenization: "edgeGram", minGrams: 2, maxGrams: 15, foldDiacritics: true },
              { type: "string" },
            ],
            plot: { type: "string" },
            cast: { type: "string" },
            directors: { type: "string" },
          },
        },
      },
    });
    console.log(`+ created ${name} search index. Atlas needs a minute or two to build it.`);
  }
} finally {
  await client.close();
}
