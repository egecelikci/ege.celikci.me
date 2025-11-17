export default async (req, context) => {
  const username = "egecelikci";
  const playingUrl = `https://api.listenbrainz.org/1/user/${username}/playing-now`;
  const recentUrl = `https://api.listenbrainz.org/1/user/${username}/listens?count=1`;

  let current = null;
  let recent = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const playingRes = await fetch(playingUrl, { signal: controller.signal });
    const playingData = await playingRes.json();
    clearTimeout(timeoutId);

    if (
      playingData?.payload?.playing_now &&
      playingData.payload.listens.length > 0
    ) {
      current = playingData.payload.listens[0];
    }

    const recentRes = await fetch(recentUrl);
    const recentData = await recentRes.json();
    recent = recentData?.payload?.listens?.[0];
  } catch (err) {
    console.error("Error fetching ListenBrainz data:", err);
    return new Response(
      `<span data-chars="X" data-status="Error loading status">Error loading status</span>`,
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=30",
        },
      },
    );
  }

  function formatListen(listen) {
    if (!listen) return null;

    const track = listen.track_metadata.track_name;
    const recordingMbid =
      listen.track_metadata.additional_info.recording_mbid ||
      listen.track_metadata.recording_msid;
    const artistNames =
      listen.track_metadata.additional_info.artist_names || [];
    const artistMbids =
      listen.track_metadata.additional_info.artist_mbids || [];

    const trackLink = recordingMbid
      ? `<a href="https://listenbrainz.org/track/${recordingMbid}" target="_blank" rel="noopener noreferrer"><cite>${track}</cite></a>`
      : `<cite>${track}</cite>`;

    const artistLinks = artistNames
      .map((name, i) => {
        const mbid = artistMbids[i];
        return mbid
          ? `<a href="https://listenbrainz.org/artist/${mbid}" target="_blank" rel="noopener noreferrer">${name}</a>`
          : name;
      })
      .join(", ");

    // Plain text version for data-status
    const plainText = `${track}, ${artistNames.join(", ")}`;

    return { trackLink, artistLinks, plainText };
  }

  const listen = formatListen(current || recent);

  if (!listen) {
    return new Response(
      `<span data-chars="X" data-status="No recent listens">No recent listens</span>`,
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60",
        },
      },
    );
  }

  const html = `<span data-chars="X" data-status="${listen.plainText}">${listen.trackLink}, ${listen.artistLinks}</span>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
};
