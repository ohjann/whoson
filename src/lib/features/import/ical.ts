export interface IcalAct {
  name: string;
  stage: string;
  startTime: string; // local ISO datetime
  endTime: string;
}

export interface IcalResult {
  title: string;
  acts: IcalAct[];
}

/**
 * Parse iCal (.ics) text into structured act data.
 * Handles VEVENT blocks with DTSTART, DTEND, SUMMARY, LOCATION.
 */
export function parseIcal(icsText: string): IcalResult {
  // Unfold continued lines (RFC 5545 §3.1)
  const unfolded = icsText.replace(/\r?\n[ \t]/g, '');

  // Extract calendar name
  const calNameMatch = unfolded.match(/X-WR-CALNAME:(.+)/);
  const title = calNameMatch?.[1]?.trim() ?? 'Imported Schedule';

  const acts: IcalAct[] = [];

  // Extract VEVENT blocks
  const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match;
  while ((match = eventRegex.exec(unfolded)) !== null) {
    const block = match[1];

    const summary = extractProperty(block, 'SUMMARY');
    const location = extractProperty(block, 'LOCATION');
    const dtstart = extractDateTime(block, 'DTSTART');
    const dtend = extractDateTime(block, 'DTEND');

    if (summary && dtstart && dtend) {
      acts.push({
        name: unescapeIcal(summary),
        stage: location ? unescapeIcal(location) : 'TBA',
        startTime: dtstart,
        endTime: dtend
      });
    }
  }

  if (acts.length === 0) {
    throw new Error('No events found in the iCal file.');
  }

  // Sort by start time
  acts.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return { title, acts };
}

/**
 * Fetch and parse an iCal feed from a URL.
 */
export async function fetchIcalFeed(url: string): Promise<IcalResult> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error('Network failure: unable to fetch iCal feed');
  }

  if (!response.ok) {
    throw new Error(`iCal feed error: HTTP ${response.status}`);
  }

  const text = await response.text();
  if (!text.includes('BEGIN:VCALENDAR')) {
    throw new Error('Not a valid iCal file — missing VCALENDAR header');
  }

  return parseIcal(text);
}

/**
 * Extract a property value from an iCal block.
 * Handles both simple (SUMMARY:value) and parameterized (SUMMARY;LANGUAGE=en:value) forms.
 */
function extractProperty(block: string, name: string): string | null {
  const regex = new RegExp(`^${name}(?:;[^:]*)?:(.+)$`, 'm');
  const match = block.match(regex);
  return match?.[1]?.trim() ?? null;
}

/**
 * Extract and convert DTSTART/DTEND to local ISO datetime string.
 * Handles formats:
 *   DTSTART:20260711T140000Z         (UTC)
 *   DTSTART:20260711T140000          (floating/local)
 *   DTSTART;TZID=Europe/London:20260711T140000
 *   DTSTART;VALUE=DATE:20260711      (all-day)
 */
function extractDateTime(block: string, name: string): string | null {
  const regex = new RegExp(`^${name}(?:;[^:]*)?:(.+)$`, 'm');
  const match = block.match(regex);
  if (!match) return null;

  const raw = match[1].trim();

  // All-day event: just a date
  if (/^\d{8}$/.test(raw)) {
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    return `${y}-${m}-${d}T00:00`;
  }

  // DateTime: YYYYMMDDTHHmmss[Z]
  const dtMatch = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?Z?$/);
  if (!dtMatch) return null;

  const [, y, mo, d, h, mi] = dtMatch;

  // If UTC (ends with Z), convert to local — but for festival apps we typically
  // want the time as displayed, so we'll keep it as-is (festival timezone handling
  // happens at the festival level, same as Clashfinder)
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

function unescapeIcal(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}
