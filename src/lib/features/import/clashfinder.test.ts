import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseClashfinderUrl, fetchClashfinderLineup, generateAuthKey } from './clashfinder.js';

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

describe('generateAuthKey (re-exported from crypto)', () => {
	it('returns a 64-char hex SHA-256 hash', async () => {
		const key = await generateAuthKey('testuser', 'secret', 'event/fest.json', '9999999999');
		expect(key).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe('fetchClashfinderLineup', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('maps response fields to Act[]', async () => {
		const mockData = {
			data: [
				{ act: 'The Band', start: '2025-06-27T20:00', end: '2025-06-27T21:30', stage: 'Main' },
				{ act: 'Solo Artist', start: '2025-06-27T22:00', end: '2025-06-27T23:00', stage: 'Tent' }
			]
		};
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify(mockData), { status: 200 })
		);

		const acts = await fetchClashfinderLineup('testfest', 'user', 'pubkey', 'privkey');

		expect(acts).toHaveLength(2);
		expect(acts[0]).toEqual({
			name: 'The Band',
			startTime: '2025-06-27T20:00',
			endTime: '2025-06-27T21:30',
			stage: 'Main'
		});
		expect(acts[1]).toEqual({
			name: 'Solo Artist',
			startTime: '2025-06-27T22:00',
			endTime: '2025-06-27T23:00',
			stage: 'Tent'
		});
	});

	it('throws on network failure', async () => {
		vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

		await expect(fetchClashfinderLineup('fest', 'u', 'pub', 'priv')).rejects.toThrow(
			'Network failure'
		);
	});

	it('throws descriptive error on 401', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response('Unauthorized', { status: 401 }));

		await expect(fetchClashfinderLineup('fest', 'u', 'pub', 'priv')).rejects.toThrow(
			'Authentication failed'
		);
	});

	it('throws descriptive error on 404', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response('Not Found', { status: 404 }));

		await expect(fetchClashfinderLineup('fest', 'u', 'pub', 'priv')).rejects.toThrow(
			'Festival not found'
		);
	});

	it('throws on malformed JSON', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response('not json', { status: 200 }));

		await expect(fetchClashfinderLineup('fest', 'u', 'pub', 'priv')).rejects.toThrow(
			'Malformed response'
		);
	});

	it('throws when data field is missing', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: 'oops' }), { status: 200 })
		);

		await expect(fetchClashfinderLineup('fest', 'u', 'pub', 'priv')).rejects.toThrow(
			'Malformed response'
		);
	});

	it('includes authUsername and authPublicKey in request URL', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ data: [] }), { status: 200 })
		);

		await fetchClashfinderLineup('myfest', 'myuser', 'mypubkey', 'myprivkey');

		const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
		expect(calledUrl).toContain('authUsername=myuser');
		expect(calledUrl).toContain('authPublicKey=mypubkey');
	});
});
