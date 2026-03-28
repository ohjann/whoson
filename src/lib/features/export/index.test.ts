import { describe, it, expect } from 'vitest';
import { exportHighlightsAsJson, exportHighlightsAsIcal } from './index';
import type { Act, Festival, UserHighlight } from '$lib/types';

const festival: Festival = {
  id: 1,
  name: 'Test Fest',
  timezone: 'Europe/Amsterdam',
  dayBoundaryHour: 6,
  startDate: '2024-06-28',
  endDate: '2024-06-30',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
};

const acts: Act[] = [
  {
    id: 1,
    festivalId: 1,
    name: 'Band Alpha',
    stage: 'Main Stage',
    startTime: '2024-06-28T21:00:00',
    endTime: '2024-06-28T22:30:00'
  },
  {
    id: 2,
    festivalId: 1,
    name: 'Band Beta',
    stage: 'Side Stage',
    startTime: '2024-06-29T23:00:00',
    endTime: '2024-06-30T00:30:00'
  }
];

const highlights: UserHighlight[] = [
  {
    id: 1,
    festivalId: 1,
    actId: 1,
    priority: 1,
    notes: 'Must see!',
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 2,
    festivalId: 1,
    actId: 2,
    priority: 2,
    createdAt: '2024-01-01T00:00:00.000Z'
  }
];

describe('exportHighlightsAsJson', () => {
  it('produces valid JSON with act details', () => {
    const json = exportHighlightsAsJson(festival, highlights, acts);
    const data = JSON.parse(json);

    expect(data.festival.name).toBe('Test Fest');
    expect(data.festival.timezone).toBe('Europe/Amsterdam');
    expect(data.highlights).toHaveLength(2);
    expect(data.exportedAt).toBeDefined();
  });

  it('includes priority, notes, stage, and times', () => {
    const json = exportHighlightsAsJson(festival, highlights, acts);
    const data = JSON.parse(json);

    const first = data.highlights[0];
    expect(first.actName).toBe('Band Alpha');
    expect(first.stage).toBe('Main Stage');
    expect(first.startTime).toBe('2024-06-28T21:00:00');
    expect(first.endTime).toBe('2024-06-28T22:30:00');
    expect(first.priority).toBe(1);
    expect(first.notes).toBe('Must see!');
  });

  it('returns empty highlights array when none provided', () => {
    const json = exportHighlightsAsJson(festival, [], acts);
    const data = JSON.parse(json);
    expect(data.highlights).toHaveLength(0);
  });

  it('ignores highlights with no matching act', () => {
    const orphan: UserHighlight = {
      id: 99,
      festivalId: 1,
      actId: 999,
      createdAt: '2024-01-01T00:00:00.000Z'
    };
    const json = exportHighlightsAsJson(festival, [orphan], acts);
    const data = JSON.parse(json);
    expect(data.highlights).toHaveLength(0);
  });
});

describe('exportHighlightsAsIcal', () => {
  it('produces valid iCal with VCALENDAR wrapper', () => {
    const ical = exportHighlightsAsIcal(festival, highlights, acts);
    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('END:VCALENDAR');
    expect(ical).toContain('VERSION:2.0');
  });

  it('contains VEVENT for each highlighted act', () => {
    const ical = exportHighlightsAsIcal(festival, highlights, acts);
    const vevents = ical.match(/BEGIN:VEVENT/g);
    expect(vevents).toHaveLength(2);
  });

  it('uses TZID parameter in DTSTART and DTEND', () => {
    const ical = exportHighlightsAsIcal(festival, highlights, acts);
    expect(ical).toContain('DTSTART;TZID=Europe/Amsterdam:20240628T210000');
    expect(ical).toContain('DTEND;TZID=Europe/Amsterdam:20240628T223000');
  });

  it('timezone correctness: second act spans midnight', () => {
    const ical = exportHighlightsAsIcal(festival, highlights, acts);
    expect(ical).toContain('DTSTART;TZID=Europe/Amsterdam:20240629T230000');
    expect(ical).toContain('DTEND;TZID=Europe/Amsterdam:20240630T003000');
  });

  it('includes SUMMARY and LOCATION', () => {
    const ical = exportHighlightsAsIcal(festival, highlights, acts);
    expect(ical).toContain('SUMMARY:Band Alpha');
    expect(ical).toContain('LOCATION:Main Stage');
  });

  it('includes DESCRIPTION when notes present', () => {
    const ical = exportHighlightsAsIcal(festival, highlights, acts);
    expect(ical).toContain('DESCRIPTION:Must see!');
  });

  it('returns valid iCal with empty highlights', () => {
    const ical = exportHighlightsAsIcal(festival, [], acts);
    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('END:VCALENDAR');
    expect(ical).not.toContain('BEGIN:VEVENT');
  });
});
