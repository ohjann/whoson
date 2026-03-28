import { describe, it, expect } from 'vitest';
import { parseJsonLineup, parseCsvLineup } from './manual';

describe('parseJsonLineup', () => {
  it('parses valid JSON with standard field names', () => {
    const json = JSON.stringify([
      {
        name: 'The Cure',
        stage: 'Main Stage',
        startTime: '2024-06-21T20:00:00',
        endTime: '2024-06-21T22:00:00'
      }
    ]);
    const result = parseJsonLineup(json);
    expect(result.errors).toHaveLength(0);
    expect(result.acts).toHaveLength(1);
    expect(result.acts[0].name).toBe('The Cure');
    expect(result.acts[0].stage).toBe('Main Stage');
    expect(result.acts[0].startTime).toBe('2024-06-21T20:00:00');
    expect(result.acts[0].endTime).toBe('2024-06-21T22:00:00');
  });

  it('parses valid JSON with start/end field names', () => {
    const json = JSON.stringify([
      {
        artist: 'Radiohead',
        stage: 'Pyramid',
        start: '2024-06-22T21:00:00',
        end: '2024-06-22T23:00:00'
      }
    ]);
    const result = parseJsonLineup(json);
    expect(result.errors).toHaveLength(0);
    expect(result.acts[0].name).toBe('Radiohead');
    expect(result.acts[0].startTime).toBe('2024-06-22T21:00:00');
  });

  it('parses valid JSON with act field name', () => {
    const json = JSON.stringify([
      {
        act: 'Blur',
        stage: 'Other Stage',
        startTime: '2024-06-23T18:00:00',
        endTime: '2024-06-23T19:30:00'
      }
    ]);
    const result = parseJsonLineup(json);
    expect(result.errors).toHaveLength(0);
    expect(result.acts[0].name).toBe('Blur');
  });

  it('returns error for entries missing required fields', () => {
    const json = JSON.stringify([{ name: 'Unknown Act', stage: 'Main Stage' }]);
    const result = parseJsonLineup(json);
    expect(result.acts).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('startTime');
    expect(result.errors[0]).toContain('endTime');
  });

  it('returns error for entry missing name', () => {
    const json = JSON.stringify([
      { stage: 'Main Stage', startTime: '2024-06-21T20:00:00', endTime: '2024-06-21T22:00:00' }
    ]);
    const result = parseJsonLineup(json);
    expect(result.acts).toHaveLength(0);
    expect(result.errors[0]).toContain('name');
  });

  it('ignores extra fields', () => {
    const json = JSON.stringify([
      {
        name: 'Blur',
        stage: 'Other Stage',
        startTime: '2024-06-23T18:00:00',
        endTime: '2024-06-23T19:30:00',
        website: 'https://blur.com',
        year: 1992
      }
    ]);
    const result = parseJsonLineup(json);
    expect(result.errors).toHaveLength(0);
    expect(result.acts).toHaveLength(1);
  });

  it('returns error for malformed JSON', () => {
    const result = parseJsonLineup('{not valid json}');
    expect(result.acts).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Invalid JSON');
  });

  it('returns error for non-array JSON', () => {
    const result = parseJsonLineup('{"name": "test"}');
    expect(result.acts).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('array');
  });

  it('handles mix of valid and invalid entries', () => {
    const json = JSON.stringify([
      {
        name: 'Valid Act',
        stage: 'Main',
        startTime: '2024-06-21T20:00:00',
        endTime: '2024-06-21T21:00:00'
      },
      { name: 'Missing Times' }
    ]);
    const result = parseJsonLineup(json);
    expect(result.acts).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.acts[0].name).toBe('Valid Act');
  });

  it('sets festivalId when provided', () => {
    const json = JSON.stringify([
      {
        name: 'Test Act',
        stage: 'Main',
        startTime: '2024-06-21T20:00:00',
        endTime: '2024-06-21T21:00:00'
      }
    ]);
    const result = parseJsonLineup(json, 'fest-123');
    expect(result.acts[0].festivalId).toBe('fest-123');
  });

  it('returns empty result for empty array', () => {
    const result = parseJsonLineup('[]');
    expect(result.acts).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe('parseCsvLineup', () => {
  it('parses valid CSV with standard headers', () => {
    const csv = `name,stage,startTime,endTime
The Cure,Main Stage,2024-06-21T20:00:00,2024-06-21T22:00:00`;
    const result = parseCsvLineup(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.acts).toHaveLength(1);
    expect(result.acts[0].name).toBe('The Cure');
    expect(result.acts[0].stage).toBe('Main Stage');
    expect(result.acts[0].startTime).toBe('2024-06-21T20:00:00');
    expect(result.acts[0].endTime).toBe('2024-06-21T22:00:00');
  });

  it('handles flexible CSV column names (artist, start, end)', () => {
    const csv = `artist,stage,start,end
Radiohead,Pyramid,2024-06-22T21:00:00,2024-06-22T23:00:00`;
    const result = parseCsvLineup(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.acts[0].name).toBe('Radiohead');
    expect(result.acts[0].startTime).toBe('2024-06-22T21:00:00');
  });

  it('handles act column name', () => {
    const csv = `act,stage,startTime,endTime
Blur,Other Stage,2024-06-23T18:00:00,2024-06-23T19:30:00`;
    const result = parseCsvLineup(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.acts[0].name).toBe('Blur');
  });

  it('returns empty result for empty input', () => {
    const result = parseCsvLineup('');
    expect(result.acts).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('returns empty result for whitespace-only input', () => {
    const result = parseCsvLineup('   \n  \n  ');
    expect(result.acts).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('returns errors for rows missing required fields', () => {
    const csv = `name,stage
Missing Times Act,Main Stage`;
    const result = parseCsvLineup(csv);
    expect(result.acts).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('startTime');
    expect(result.errors[0]).toContain('endTime');
  });

  it('handles file with only headers', () => {
    const csv = 'name,stage,startTime,endTime';
    const result = parseCsvLineup(csv);
    expect(result.acts).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('handles multiple rows', () => {
    const csv = `name,stage,startTime,endTime
The Cure,Main Stage,2024-06-21T20:00:00,2024-06-21T22:00:00
Radiohead,Pyramid,2024-06-22T21:00:00,2024-06-22T23:00:00
Blur,Other Stage,2024-06-23T18:00:00,2024-06-23T19:30:00`;
    const result = parseCsvLineup(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.acts).toHaveLength(3);
  });

  it('sets festivalId when provided', () => {
    const csv = `name,stage,startTime,endTime
Test Act,Main,2024-06-21T20:00:00,2024-06-21T21:00:00`;
    const result = parseCsvLineup(csv, 'fest-456');
    expect(result.acts[0].festivalId).toBe('fest-456');
  });
});
