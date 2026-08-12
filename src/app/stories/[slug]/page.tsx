import { notFound } from "next/navigation";
import Breadcrumbs, { type BreadcrumbItem } from "@/app/Breadcrumbs";
import PublicNavbar from "@/app/PublicNavbar";
import { getStoryBySlug, publicMediaUrl } from "@/lib/public-reading";
import { storyDestinationCrumbs } from "@/lib/destination";
import ShareButton from "./ShareButton";
import ArticleEditor from "./ArticleEditor";
import ViewTracker from "./ViewTracker";

/* eslint-disable @next/next/no-img-element */

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
          <div className="mt-6 flex gap-4 text-sm text-[#718078]">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${story.country ?? ""} ${story.city ?? ""}`,
              )}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#c1664b]"
            >
              開啟地圖
            </a>
            <ShareButton />
          </div>
          <ArticleEditor
            storyId={story.id}
            sourceId={story.source_id ?? ""}
            title={story.title}
          />
        </header>

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
          {story.media.map((media, index) => {
            const src = publicMediaUrl(media.storage_path);
            const isLeadMedia = index === 0;

            if (media.kind === "video") {
              return (
                <video
                  key={media.storage_path}
                  src={src}
                  controls
                  className={`w-full rounded-2xl ${isLeadMedia ? "sm:col-span-2" : ""}`}
                />
              );
            }

            return (
              <figure
                key={media.storage_path}
                className={isLeadMedia ? "sm:col-span-2" : ""}
              >
                <div
                  className={
                    isLeadMedia
                      ? "overflow-hidden rounded-2xl"
                      : "flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-[#eef2ee]"
                  }
                >
                  <img
                    src={src}
                    alt={media.alt_text}
                    className={
                      isLeadMedia ? "h-auto w-full" : "h-full w-full object-contain"
                    }
                  />
                </div>
                <figcaption className="mt-2 text-sm text-[#718078]">
                  {media.caption}
                </figcaption>
              </figure>
            );
          })}
        </div>

        <div className="mx-auto mt-14 max-w-2xl whitespace-pre-wrap text-lg leading-9 text-[#667870]">
          {story.body}
        </div>
      </article>
    </main>
  );
}
