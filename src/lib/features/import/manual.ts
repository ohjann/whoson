import type { Act } from '$lib/types';

export interface ParseResult {
  acts: Act[];
  errors: string[];
}

function extractField(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim() !== '') {
      return val.trim();
    }
  }
  return undefined;
}

export function parseJsonLineup(json: string, festivalId = 0): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { acts: [], errors: ['Invalid JSON'] };
  }

  if (!Array.isArray(raw)) {
    return { acts: [], errors: ['JSON must be an array of objects'] };
  }

  const acts: Act[] = [];
  const errors: string[] = [];

  raw.forEach((item, i) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      errors.push(`Entry ${i}: not an object`);
      return;
    }
    const obj = item as Record<string, unknown>;

    const name = extractField(obj, 'name', 'artist', 'act');
    const stage = extractField(obj, 'stage');
    const startTime = extractField(obj, 'startTime', 'start');
    const endTime = extractField(obj, 'endTime', 'end');

    const missing: string[] = [];
    if (!name) missing.push('name');
    if (!stage) missing.push('stage');
    if (!startTime) missing.push('startTime');
    if (!endTime) missing.push('endTime');

    if (missing.length > 0) {
      errors.push(`Entry ${i}: missing required fields: ${missing.join(', ')}`);
      return;
    }

    acts.push({
      festivalId,
      name: name!,
      stage: stage!,
      startTime: startTime!,
      endTime: endTime!
    });
  });

  return { acts, errors };
}

export function parseCsvLineup(csv: string, festivalId = 0): ParseResult {
  const lines = csv
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { acts: [], errors: [] };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const acts: Act[] = [];
  const errors: string[] = [];

  const nameIdx = headers.findIndex((h) => ['name', 'artist', 'act'].includes(h));
  const stageIdx = headers.indexOf('stage');
  const startIdx = headers.findIndex((h) => ['starttime', 'start'].includes(h));
  const endIdx = headers.findIndex((h) => ['endtime', 'end'].includes(h));

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());

    const name = nameIdx >= 0 && cols[nameIdx] ? cols[nameIdx] : undefined;
    const stage = stageIdx >= 0 && cols[stageIdx] ? cols[stageIdx] : undefined;
    const startTime = startIdx >= 0 && cols[startIdx] ? cols[startIdx] : undefined;
    const endTime = endIdx >= 0 && cols[endIdx] ? cols[endIdx] : undefined;

    const missing: string[] = [];
    if (!name) missing.push('name');
    if (!stage) missing.push('stage');
    if (!startTime) missing.push('startTime');
    if (!endTime) missing.push('endTime');

    if (missing.length > 0) {
      errors.push(`Row ${i}: missing required fields: ${missing.join(', ')}`);
      continue;
    }

    acts.push({
      festivalId,
      name: name!,
      stage: stage!,
      startTime: startTime!,
      endTime: endTime!
    });
  }

  return { acts, errors };
}
