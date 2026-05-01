export const url = "/events.ics";
export const layout = null;

export default function ({ mb_events }: any) {
  const events = mb_events?.upcoming || [];

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ege.celikci.me//NONSGML Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Events in İzmir",
    "X-WR-TIMEZONE:Europe/Istanbul",
  ];

  const escape = (str: string) =>
    String(str || "")
      .replace(/\\/g, "\\\\")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;")
      .replace(/\n/g, "\\n");

  const formatDate = (date: any, timeStr?: string) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";

    // MusicBrainz dates (YYYY-MM-DD) are parsed as UTC 00:00 by new Date()
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dateDay = String(d.getUTCDate()).padStart(2, "0");

    if (timeStr) {
      const [hh, mm] = timeStr.split(":").map((s) => s.padStart(2, "0"));
      return `${y}${m}${dateDay}T${hh}${mm}00`;
    }
    // All day event if no time
    return `${y}${m}${dateDay}`;
  };

  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  for (const event of events) {
    if (!event.beginDate) continue;

    const startDate = new Date(event.beginDate);
    if (isNaN(startDate.getTime())) continue;

    const startStr = formatDate(startDate, event.time);
    let endStr = "";
    if (event.time) {
      // Estimate end time as +3 hours for concerts
      const [h, m] = event.time.split(":").map(Number);
      const endDate = new Date(startDate);
      endDate.setUTCHours(h + 3, m);
      endStr = formatDate(
        endDate,
        `${String(endDate.getUTCHours()).padStart(2, "0")}:${
          String(endDate.getUTCMinutes()).padStart(2, "0")
        }`,
      );
    } else {
      // Next day for all-day events
      const nextDay = new Date(startDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      endStr = formatDate(nextDay);
    }

    icsLines.push("BEGIN:VEVENT");
    icsLines.push(`UID:${event.id}@ege.celikci.me`);
    icsLines.push(`DTSTAMP:${dtstamp}`);

    if (event.time) {
      // Use floating time with TZID for local time accuracy
      icsLines.push(`DTSTART;TZID=Europe/Istanbul:${startStr}`);
      icsLines.push(`DTEND;TZID=Europe/Istanbul:${endStr}`);
    } else {
      // All day events use VALUE=DATE
      icsLines.push(`DTSTART;VALUE=DATE:${startStr}`);
      icsLines.push(`DTEND;VALUE=DATE:${endStr}`);
    }

    const displayTitle = event.displayTitle || event.name || "Event";
    const artists = event.artists || [];

    icsLines.push(`SUMMARY:${escape(displayTitle)}`);
    icsLines.push(
      `DESCRIPTION:${
        escape(
          `Artists: ${
            artists.join(", ")
          }\n\nDetails: https://ege.celikci.me/event/${event.id}/`,
        )
      }`,
    );
    const venueName = event.relations?.find((r: any) =>
      r["target-type"] === "place"
    )?.place?.name || "TBA";

    icsLines.push(`LOCATION:${escape(venueName)}`);
    icsLines.push(`URL:https://ege.celikci.me/event/${event.id}/`);
    icsLines.push("END:VEVENT");
  }

  icsLines.push("END:VCALENDAR");

  // iCal line folding (75 octets)
  const fold = (line: string): string => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(line);
    if (bytes.length <= 75) return line;

    const parts: string[] = [];
    let offset = 0;
    let first = true;
    const decoder = new TextDecoder();

    while (offset < bytes.length) {
      const max = first ? 75 : 74; // continuation lines start with a space (1 octet)
      // Find safe split point (don't cut mid-multibyte-sequence)
      let end = Math.min(offset + max, bytes.length);
      while (end > offset && (bytes[end] & 0xC0) === 0x80) end--; // back off from continuation bytes
      parts.push((first ? "" : " ") + decoder.decode(bytes.slice(offset, end)));
      offset = end;
      first = false;
    }
    return parts.join("\r\n");
  };

  return icsLines.map(fold).join("\r\n");
}
