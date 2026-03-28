import { generateAuthKey } from './crypto.js';

export interface Act {
	name: string;
	startTime: string;
	endTime: string;
	stage: string;
}

export interface ClashfinderResult {
	title: string;
	acts: Act[];
}

interface ClashfinderAct {
	act: string;
	start: string;
	end: string;
	stage: string;
}

interface ClashfinderResponse {
	title?: string;
	data?: ClashfinderAct[];
	[key: string]: unknown;
}

export { generateAuthKey };

export function parseClashfinderUrl(url: string): string | null {
	try {
		const parsed = new URL(url);
		if (!parsed.hostname.includes('clashfinder.com')) return null;
		// Matches /s/{slug}/ or /s/{slug}
		const match = parsed.pathname.match(/^\/s\/([^/]+)\/?$/);
		return match ? match[1] : null;
	} catch {
		return null;
	}
}

export async function fetchClashfinderLineup(
	slug: string,
	username: string,
	publicKey: string,
	privateKey: string
): Promise<ClashfinderResult> {
	const authValidUntil = String(Math.floor(Date.now() / 1000) + 3600);
	const authParam = `event/${slug}.json`;
	const authKey = await generateAuthKey(username, privateKey, authParam, authValidUntil);

	const params = new URLSearchParams({
		authUsername: username,
		authPublicKey: publicKey,
		authKey,
		authValidUntil
	});

	const url = `https://clashfinder.com/data/event/${slug}.json?${params}`;

	let response: Response;
	try {
		response = await fetch(url);
	} catch {
		throw new Error('Network failure: unable to reach Clashfinder API');
	}

	if (response.status === 401) {
		throw new Error('Authentication failed: invalid credentials');
	}
	if (response.status === 404) {
		throw new Error(`Festival not found: invalid slug "${slug}"`);
	}
	if (!response.ok) {
		throw new Error(`Clashfinder API error: HTTP ${response.status}`);
	}

	let json: ClashfinderResponse;
	try {
		json = await response.json();
	} catch {
		throw new Error('Malformed response: invalid JSON from Clashfinder API');
	}

	const acts = json.data;
	if (!Array.isArray(acts)) {
		throw new Error('Malformed response: expected data array in Clashfinder response');
	}

	// Derive title from response, falling back to a humanized slug
	const title = typeof json.title === 'string' && json.title.trim()
		? json.title.trim()
		: slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

	return {
		title,
		acts: acts.map((item) => ({
			name: item.act,
			startTime: item.start,
			endTime: item.end,
			stage: item.stage
		}))
	};
}
