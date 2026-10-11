import { notFound } from "next/navigation";
import Breadcrumbs, { type BreadcrumbItem } from "@/app/Breadcrumbs";
import PublicNavbar from "@/app/PublicNavbar";
import { getStoryBySlug } from "@/lib/public-reading";
import { storyDestinationCrumbs } from "@/lib/destination";
import ArticleEditor from "./ArticleEditor";
import ViewTracker from "./ViewTracker";
import StoryGallery from "./StoryGallery";

export const dynamic = "force-dynamic";

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const story = await getStoryBySlug((await params).slug);
  if (!story) notFound();

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "首頁", href: "/" },
    ...storyDestinationCrumbs(story),
    { label: story.title },
  ];
  return (
    <main className="min-h-screen bg-[#fdfcf8]">
      <ViewTracker storyId={story.id} />
      <PublicNavbar />
      <article className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-8">
        <Breadcrumbs items={breadcrumbs} />
        <header className="mx-auto mt-12 max-w-3xl">
          <p className="text-xs tracking-[0.16em] text-[#c1664b]">
            {[...story.classification_labels, story.city].filter(Boolean).join(" · ")}
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-[#31413d] sm:text-6xl">
            {story.title}
          </h1>
          <ArticleEditor
            storyId={story.id}
            sourceId={story.source_id ?? ""}
            title={story.title}
          />
        </header>

        <StoryGallery photos={story.media.filter((media) => media.kind === "photo" && media.url)} />

        <div className="mx-auto mt-14 max-w-2xl whitespace-pre-wrap text-lg leading-9 text-[#667870]">
          {story.body}
        </div>
        {story.media.some((media) => media.kind === "video") && <section aria-label="????" className="mx-auto mt-10 max-w-4xl space-y-6">
          {story.media.filter((media) => media.kind === "video").map((media) => <figure key={media.storage_path}>
            <video src={media.url} controls preload="metadata" className="mx-auto max-h-[75vh] w-full rounded-2xl bg-[#18231f]" />
            {media.caption && <figcaption className="mt-2 text-sm text-[#718078]">{media.caption}</figcaption>}
          </figure>)}
        </section>}
      </article>
    </main>
  );
}
