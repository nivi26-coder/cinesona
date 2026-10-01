import { TitlePage, titleMetadata } from "@/components/TitlePage";

export async function generateMetadata(props: PageProps<"/games/[slug]">) {
  return titleMetadata("game", (await props.params).slug);
}

export default async function GamePage(props: PageProps<"/games/[slug]">) {
  return <TitlePage kind="game" slug={(await props.params).slug} />;
}
