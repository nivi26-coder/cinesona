import { TitlePage, titleMetadata } from "@/components/TitlePage";

// `id` is the movie's slug (/movies/the-godfather-1972). Week 1 links used the
// sample_mflix ObjectId instead; TitlePage redirects those to the slug URL.

export async function generateMetadata(props: PageProps<"/movies/[id]">) {
  return titleMetadata("movie", (await props.params).id);
}

export default async function MoviePage(props: PageProps<"/movies/[id]">) {
  return <TitlePage kind="movie" slug={(await props.params).id} />;
}
