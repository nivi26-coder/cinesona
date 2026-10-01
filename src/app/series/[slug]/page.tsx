import { TitlePage, titleMetadata } from "@/components/TitlePage";

export async function generateMetadata(props: PageProps<"/series/[slug]">) {
  return titleMetadata("series", (await props.params).slug);
}

export default async function SeriesPage(props: PageProps<"/series/[slug]">) {
  return <TitlePage kind="series" slug={(await props.params).slug} />;
}
