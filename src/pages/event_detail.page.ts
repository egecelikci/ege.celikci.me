import { exists } from "@std/fs/exists";

export const searchable = true;

async function collectGalleryImages(
  eventId: string,
  basePath: string,
  photographers: Record<string, { name: string; url?: string }>,
  defaultPhotographer?: { name: string; url?: string },
): Promise<Array<{ src: string; alt: string; photographer?: object }>> {
  const images: Array<{ src: string; alt: string; photographer?: object }> = [];
  if (!await exists(basePath)) return images;

  for await (const entry of Deno.readDir(basePath)) {
    if (entry.isFile && /\.(jpg|jpeg|png|webp|avif)$/i.test(entry.name)) {
      images.push({
        src: `/assets/images/events/${eventId}/${entry.name}`,
        alt: `Photograph from event`,
        photographer: defaultPhotographer,
      });
    } else if (entry.isDirectory) {
      const photographer = photographers[entry.name] ?? { name: entry.name };
      const subPath = `${basePath}/${entry.name}`;
      for await (const sub of Deno.readDir(subPath)) {
        if (sub.isFile && /\.(jpg|jpeg|png|webp|avif)$/i.test(sub.name)) {
          images.push({
            src: `/assets/images/events/${eventId}/${entry.name}/${sub.name}`,
            alt: `Photograph by ${photographer.name}`,
            photographer,
          });
        }
      }
    }
  }
  return images;
}

export default async function* ({ mb_events, events }: any) {
  const rawEvents = mb_events?.events || mb_events?.all;
  if (!rawEvents) return;

  for (const event of rawEvents) {
    const local = events?.[event.id] || {};

    // Check for local gallery images
    const galleryPath = `src/assets/images/events/${event.id}`;
    const gallery = await collectGalleryImages(
      event.id,
      galleryPath,
      local.photographers ?? {},
      local.photographer,
    ).catch((err) => {
      console.warn(`[event_detail] gallery scan failed for ${event.id}:`, err);
      return [];
    });

    // 2. Header Extension Setup (Sources)
    const headerSources = [
      {
        label: "MusicBrainz",
        url: `https://musicbrainz.org/event/${event.id}`,
        icon: "musicbrainz",
        catalog: "simpleicons",
      },
    ];
    if (local.instagram_url) {
      headerSources.push({
        label: "Instagram",
        url: local.instagram_url,
        icon: "instagram",
        catalog: "simpleicons",
      });
    }

    // Note: `local` is spread here for two generator-time needs:
    //   1. collectGalleryImages needs local.photographers
    //   2. headerSources needs local.instagram_url
    // The preprocessor will also set event.local from the same source —
    // this is redundant but harmless; both read from the same events.yml data.
    yield {
      url: `/event/${event.id}/`,
      title: event.displayTitle || event.name,
      event: { ...event, local },
      gallery,
      layout: "layouts/event.vto",
      backlink: { href: "/events/", text: "events" },
      prose: false,
      headerExtension: {
        comp: "ui.SourceMeta",
        props: {
          sources: headerSources,
          variant: "minimal",
        },
      },
      coverImage: event.imagePath || event.posterThumb || event.posterUrl,
      description: local.description || event.disambiguation,
    };
  }
}
