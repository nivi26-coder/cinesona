// One genre vocabulary across movies, series, anime and games, so the genre
// filter means the same thing on every tab. sample_mflix names are the base;
// TMDB and IGDB names are mapped onto them. Unlisted names pass through as-is.
const MAP = {
  // TMDB movies / TV
  "Science Fiction": ["Sci-Fi"],
  "Sci-Fi & Fantasy": ["Sci-Fi", "Fantasy"],
  "Action & Adventure": ["Action", "Adventure"],
  "War & Politics": ["War"],
  Kids: ["Family"],
  Talk: ["Talk-Show"],
  Reality: ["Reality-TV"],
  "TV Movie": [],

  // IGDB genres
  "Role-playing (RPG)": ["RPG"],
  "Real Time Strategy (RTS)": ["Strategy"],
  "Turn-based strategy (TBS)": ["Strategy"],
  "Hack and slash/Beat 'em up": ["Hack and slash"],
  Simulator: ["Simulation"],
  "Card & Board Game": ["Card & Board"],
  "Quiz/Trivia": ["Trivia"],

  // IGDB themes
  "Science fiction": ["Sci-Fi"],
  Historical: ["History"],
  Warfare: ["War"],
  "Non-fiction": ["Documentary"],
  "4X": ["Strategy"],
  Business: [],
  Erotic: [],
};

export function mapGenres(names) {
  return [...new Set(names.flatMap((name) => MAP[name] ?? [name]))];
}
