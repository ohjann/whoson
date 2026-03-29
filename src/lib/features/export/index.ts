import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import type { Act, Festival, UserHighlight } from '$lib/types';

export interface ExportHighlight {
  actName: string;
  stage: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

export interface ExportData {
  festival: { name: string; timezone: string };
  highlights: ExportHighlight[];
  exportedAt: string;
}

function parseLocalTime(isoString: string, timezone: string): TZDate {
  const [datePart, timePart] = isoString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second = 0] = timePart.split(':').map(Number);
  return TZDate.tz(timezone, year, month - 1, day, hour, minute, second);
}

function buildHighlightList(
  highlights: UserHighlight[],
  acts: Act[]
): Array<{ act: Act; highlight: UserHighlight }> {
  const actMap = new Map(acts.map((a) => [a.id, a]));
  const result: Array<{ act: Act; highlight: UserHighlight }> = [];
  for (const h of highlights) {
    const act = actMap.get(h.actId);
    if (act) result.push({ act, highlight: h });
  }
  result.sort((a, b) => a.act.startTime.localeCompare(b.act.startTime));
  return result;
}

export function exportHighlightsAsJson(
  festival: Festival,
  highlights: UserHighlight[],
  acts: Act[]
): string {
  const items = buildHighlightList(highlights, acts);
  const data: ExportData = {
    festival: { name: festival.name, timezone: festival.timezone },
    highlights: items.map(({ act, highlight }) => ({
      actName: act.name,
      stage: act.stage,
      startTime: act.startTime,
      endTime: act.endTime,
      notes: highlight.notes
    })),
    exportedAt: new Date().toISOString()
  };
  return JSON.stringify(data, null, 2);
}

function formatIcalDate(isoString: string, timezone: string): string {
  const tzDate = parseLocalTime(isoString, timezone);
  // Format as YYYYMMDDTHHmmss (local time, no Z)
  const y = tzDate.getFullYear();
  const mo = String(tzDate.getMonth() + 1).padStart(2, '0');
  const d = String(tzDate.getDate()).padStart(2, '0');
  const h = String(tzDate.getHours()).padStart(2, '0');
  const mi = String(tzDate.getMinutes()).padStart(2, '0');
  const s = String(tzDate.getSeconds()).padStart(2, '0');
  return `${y}${mo}${d}T${h}${mi}${s}`;
}

function escapeIcal(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function exportHighlightsAsIcal(
  festival: Festival,
  highlights: UserHighlight[],
  acts: Act[]
): string {
  const items = buildHighlightList(highlights, acts);
  const tz = festival.timezone;
  const now = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");

  const vevents = items.map(({ act, highlight }) => {
    const uid = `whoson-act-${act.id ?? act.name.replace(/\s+/g, '-')}-${act.startTime}@whoson.app`;
    const dtstart = formatIcalDate(act.startTime, tz);
    const dtend = formatIcalDate(act.endTime, tz);
    const summary = escapeIcal(act.name);
    const location = escapeIcal(act.stage);
    const description = highlight.notes ? escapeIcal(highlight.notes) : '';

    const lines = [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=${tz}:${dtstart}`,
      `DTEND;TZID=${tz}:${dtend}`,
      `SUMMARY:${summary}`,
      `LOCATION:${location}`
    ];
    if (description) lines.push(`DESCRIPTION:${description}`);
    lines.push('END:VEVENT');
    return lines.join('\r\n');
  });

  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//WhosOn//Festival Schedule//EN`,
    `X-WR-CALNAME:${escapeIcal(festival.name)} - Highlights`,
    `X-WR-TIMEZONE:${tz}`,
    ...vevents,
    'END:VCALENDAR'
  ].join('\r\n');

  return calendar;
}

export async function copyShareableText(
  festival: Festival,
  highlights: UserHighlight[],
  acts: Act[]
): Promise<void> {
  const items = buildHighlightList(highlights, acts);
  const tz = festival.timezone;

  // Group by festival day
  const byDay = new Map<string, Array<{ act: Act; highlight: UserHighlight }>>();
  for (const item of items) {
    const tzDate = parseLocalTime(item.act.startTime, tz);
    const y = tzDate.getFullYear();
    const mo = String(tzDate.getMonth() + 1).padStart(2, '0');
    const d = String(tzDate.getDate()).padStart(2, '0');
    const dayKey = `${y}-${mo}-${d}`;
    if (!byDay.has(dayKey)) byDay.set(dayKey, []);
    byDay.get(dayKey)!.push(item);
  }

  const lines: string[] = [`My highlights for ${festival.name}`, ''];
  for (const [day, dayItems] of byDay) {
    lines.push(`=== ${day} ===`);
    for (const { act, highlight } of dayItems) {
      const time = act.startTime.slice(11, 16);
      lines.push(`${time} ${act.name} @ ${act.stage}`);
      if (highlight.notes) lines.push(`  Note: ${highlight.notes}`);
    }
    lines.push('');
  }

  await navigator.clipboard.writeText(lines.join('\n'));
}
