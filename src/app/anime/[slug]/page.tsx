import { TitlePage, titleMetadata } from "@/components/TitlePage";

export async function generateMetadata(props: PageProps<"/anime/[slug]">) {
  return titleMetadata("anime", (await props.params).slug);
}

export default async function AnimePage(props: PageProps<"/anime/[slug]">) {
  return <TitlePage kind="anime" slug={(await props.params).slug} />;
}
