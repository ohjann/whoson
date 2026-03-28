import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseClashfinderUrl, fetchClashfinderLineup, parseClashfinderHtml } from './clashfinder.js';

function loadFixture(name: string): string {
	return readFileSync(resolve(__dirname, '__fixtures__', name), 'utf-8');
}

describe('parseClashfinderUrl', () => {
	it('extracts slug from standard URL', () => {
		expect(parseClashfinderUrl('https://clashfinder.com/s/glastonbury2025/')).toBe(
			'glastonbury2025'
		);
	});

	it('extracts slug without trailing slash', () => {
		expect(parseClashfinderUrl('https://clashfinder.com/s/foo')).toBe('foo');
	});

	it('returns null for non-clashfinder URL', () => {
		expect(parseClashfinderUrl('https://example.com/s/slug/')).toBeNull();
	});

	it('returns null for invalid URL', () => {
		expect(parseClashfinderUrl('not-a-url')).toBeNull();
	});

	it('returns null for clashfinder URL without /s/ path', () => {
		expect(parseClashfinderUrl('https://clashfinder.com/other/slug/')).toBeNull();
	});

	it('returns null for empty string', () => {
		expect(parseClashfinderUrl('')).toBeNull();
	});
});

describe('parseClashfinderHtml', () => {
	const SAMPLE_HTML = `
		<script>var cg = { festName: "Test Festival 2025", getName: "testfest" };</script>
		<div class="days">
		<div class="day" data-day="1751241600000" data-day-str="2025/06/30 00:00">
		<div class="stageContainer"><div class="stageNameWrap"><p class="stageName">Main Stage</p></div>
		<div class="actsContainer">
		<div class="stageRow"></div>
		<div class="act id-theban occ-1" data-short="theban" data-start="72000000" data-end="77400000" style="width: 10%;">
			<div class="actNmWrap"><h6 class="actNm">The Band</h6></div>
			<p class="actTime">20:00 - 21:30</p>
		</div>
		<div class="act id-soloa occ-1" data-short="soloa" data-start="79200000" data-end="82800000" style="width: 10%;">
			<div class="actNmWrap"><h6 class="actNm">Solo Artist</h6></div>
			<p class="actTime">22:00 - 23:00</p>
		</div>
		</div></div>
		<div class="stageContainer"><div class="stageNameWrap"><p class="stageName">The Tent</p></div>
		<div class="actsContainer">
		<div class="stageRow"></div>
		<div class="act id-djset occ-1" data-short="djset" data-start="75600000" data-end="82800000" style="width: 20%;">
			<div class="actNmWrap"><h6 class="actNm">DJ Set</h6></div>
			<p class="actTime">21:00 - 23:00</p>
		</div>
		</div></div>
		<div class="timeLineHide"></div>
		</div>
		</div><!-- class="days" -->
	`;

	it('extracts festival title from cg object', () => {
		const result = parseClashfinderHtml(SAMPLE_HTML, 'testfest');
		expect(result.title).toBe('Test Festival 2025');
	});

	it('falls back to humanized slug when no title', () => {
		const html = SAMPLE_HTML.replace('festName: "Test Festival 2025"', '');
		const result = parseClashfinderHtml(html, 'my-fest-2025');
		expect(result.title).toBe('My Fest 2025');
	});

	it('extracts all acts with correct fields', () => {
		const result = parseClashfinderHtml(SAMPLE_HTML, 'testfest');
		expect(result.acts).toHaveLength(3);
		expect(result.acts[0]).toEqual({
			name: 'The Band',
			stage: 'Main Stage',
			startTime: '2025-06-30T20:00',
			endTime: '2025-06-30T21:30'
		});
	});

	it('assigns correct stage names', () => {
		const result = parseClashfinderHtml(SAMPLE_HTML, 'testfest');
		expect(result.acts[0].stage).toBe('Main Stage');
		expect(result.acts[1].stage).toBe('Main Stage');
		expect(result.acts[2].stage).toBe('The Tent');
	});

	it('throws when no acts found', () => {
		expect(() => parseClashfinderHtml('<html><body></body></html>', 'empty')).toThrow(
			'No acts found'
		);
	});

	it('decodes HTML entities in act names', () => {
		const html = SAMPLE_HTML.replace('The Band', 'Tom &amp; Jerry');
		const result = parseClashfinderHtml(html, 'testfest');
		expect(result.acts[0].name).toBe('Tom & Jerry');
	});
});

describe('fetchClashfinderLineup', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('fetches the HTML page without auth', async () => {
		const html = `
			<script>var cg = { festName: "Fest" };</script>
			<div class="days">
			<div class="day" data-day="1751241600000" data-day-str="2025/06/30 00:00" data-day-sz="100">
			<div class="stageContainer"><div class="stageNameWrap"><p class="stageName">Stage</p></div>
			<div class="actsContainer">
			<div class="stageRow"></div>
			<div class="act id-act1 occ-1" data-short="act1" data-start="43200000" data-end="45000000" style="width: 10%;">
				<div class="actNmWrap"><h6 class="actNm">Act</h6></div><p class="actTime">12:00 - 12:30</p>
			</div>
			</div></div>
			<div class="timeLineHide"></div>
			</div>
			</div><!-- class="days" -->
		`;
		vi.mocked(fetch).mockResolvedValue(new Response(html, { status: 200 }));

		const result = await fetchClashfinderLineup('myfest');

		const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
		// In jsdom (test env), hostname is 'localhost' so the proxy path is used
		expect(calledUrl).toContain('/s/myfest/');
		expect(calledUrl).not.toContain('auth');
		expect(result.acts).toHaveLength(1);
	});

	it('throws on 404', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response('Not Found', { status: 404 }));
		await expect(fetchClashfinderLineup('nope')).rejects.toThrow('does not exist');
	});

	it('throws on network failure', async () => {
		vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
		await expect(fetchClashfinderLineup('fest')).rejects.toThrow('Network failure');
	});
});

describe('regression: real Clashfinder pages', () => {
	it('parses Meadowside 2026 (single day, single stage, 7 acts)', () => {
		const html = loadFixture('meadowside26.html');
		const result = parseClashfinderHtml(html, 'meadowside26');

		expect(result.title).toBe('Meadowside Music Festival 2026');
		expect(result.acts).toHaveLength(7);

		// Spot-check first and last acts
		expect(result.acts[0]).toEqual({
			name: 'Community Acts',
			stage: 'Main Stage',
			startTime: '2026-07-11T12:00',
			endTime: '2026-07-11T12:45'
		});
		expect(result.acts[6]).toEqual({
			name: 'Doubting Thomas',
			stage: 'Main Stage',
			startTime: '2026-07-11T18:10',
			endTime: '2026-07-11T19:00'
		});

		// All acts are on Main Stage
		expect(result.acts.every(a => a.stage === 'Main Stage')).toBe(true);
	});

	it('parses Secret Island Festival 2026 (multi-day, multi-stage)', () => {
		const html = loadFixture('sif2026.html');
		const result = parseClashfinderHtml(html, 'sif2026');

		expect(result.title).toBe('Secret Island Festival 2026');
		expect(result.acts.length).toBeGreaterThanOrEqual(11);

		// Multiple stages
		const stages = [...new Set(result.acts.map(a => a.stage))];
		expect(stages).toContain('Main stage');
		expect(stages).toContain('Stage 1');
		expect(stages.length).toBeGreaterThanOrEqual(2);

		// Multiple days
		const days = [...new Set(result.acts.map(a => a.startTime.split('T')[0]))];
		expect(days.length).toBeGreaterThanOrEqual(2);

		// All times should be valid ISO format
		for (const act of result.acts) {
			expect(act.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
			expect(act.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
		}
	});
});
