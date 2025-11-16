export default async (req, context) => {
  const username = "egecelikci";
  const playingUrl = `https://api.listenbrainz.org/1/user/${username}/playing-now`;
  const recentUrl = `https://api.listenbrainz.org/1/user/${username}/listens?count=1`;

  let current = null;
  let recent = null;

  try {
    const playingRes = await fetch(playingUrl);
    const playingData = await playingRes.json();
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
  }

  function formatListen(listen) {
    if (!listen)
      return {
        trackLink: "Unknown",
        artistLinks: "Unknown",
        text: "Unknown track",
      };
    const track = listen.track_metadata.track_name;
    const recordingMbid =
      listen.track_metadata.additional_info.recording_mbid ||
      listen.track_metadata.recording_msid;
    const artistNames =
      listen.track_metadata.additional_info.artist_names || [];
    const artistMbids =
      listen.track_metadata.additional_info.artist_mbids || [];
    const artists = artistNames.map((name, i) => ({
      name,
      mbid: artistMbids[i] || null,
    }));

    const trackLink = recordingMbid
      ? `<a href="https://listenbrainz.org/track/${recordingMbid}" target="_blank" rel="noopener noreferrer">${track}</a>`
      : track;

    const artistLinks = artists
      .map((a) =>
        a.mbid
          ? `<a href="https://listenbrainz.org/artist/${a.mbid}" target="_blank" rel="noopener noreferrer">${a.name}</a>`
          : a.name,
      )
      .join(", ");

    return {
      trackLink,
      artistLinks,
      text: `${track} by ${artists.map((a) => a.name).join(", ")}`,
    };
  }

  let html = `<span data-chars="X" data-status="No recent listens">No recent listens</span>`;

  if (current) {
    const listen = formatListen(current);
    html = `<span data-chars="X" data-status="${listen.text}">listening to ${listen.trackLink} by ${listen.artistLinks}</span>`;
  } else if (recent) {
    const listen = formatListen(recent);
    const listenedAt = new Date(recent.listened_at * 1000);
    const secondsAgo = Math.floor((Date.now() - listenedAt) / 1000);
    const minutes = Math.floor(secondsAgo / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let relativeTime = "";
    if (days > 0) relativeTime = `${days} day${days > 1 ? "s" : ""} ago`;
    else if (hours > 0)
      relativeTime = `${hours} hour${hours > 1 ? "s" : ""} ago`;
    else if (minutes > 0)
      relativeTime = `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    else relativeTime = "just now";

    html = `<span data-chars="X" data-status="${listen.text}, ${relativeTime}">listened to ${listen.trackLink} by ${listen.artistLinks}, ${relativeTime}</span>`;
  }

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
};
