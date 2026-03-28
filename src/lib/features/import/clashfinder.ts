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

export function parseClashfinderUrl(url: string): string | null {
	try {
		const parsed = new URL(url);
		if (!parsed.hostname.includes('clashfinder.com')) return null;
		// Accept both /s/ (desktop) and /m/ (mobile) URLs
		const match = parsed.pathname.match(/^\/[sm]\/([^/]+)\/?$/);
		return match ? match[1] : null;
	} catch {
		return null;
	}
}

/**
 * Fetch and parse a Clashfinder lineup from the public HTML page.
 * No authentication required — works for any public festival.
 * Uses a Vite dev proxy on localhost to avoid CORS.
 */
export async function fetchClashfinderLineup(slug: string): Promise<ClashfinderResult> {
	const base =
		typeof window !== 'undefined' && window.location.hostname === 'localhost'
			? '/clashfinder-proxy'
			: 'https://clashfinder.com';
	// Always use /s/ (desktop) path — it has the full HTML structure we parse
	const url = `${base}/s/${slug}/`;

	let response: Response;
	try {
		response = await fetch(url);
	} catch {
		throw new Error('Network failure: unable to reach Clashfinder');
	}

	if (response.status === 404) {
		throw new Error(`Festival not found: "${slug}" does not exist on Clashfinder`);
	}
	if (!response.ok) {
		throw new Error(`Clashfinder error: HTTP ${response.status}`);
	}

	const html = await response.text();
	return parseClashfinderHtml(html, slug);
}

/**
 * Parse Clashfinder HTML into structured act data.
 *
 * Page structure (verified against real pages):
 *   <div class="day" data-day="1783728000000" data-day-str="2026/07/11 00:00">
 *     <div class="stageContainer">
 *       <p class="stageName">Main Stage</p>
 *       <div class="actsContainer">
 *         <div class="act ..." data-start="43200000" data-end="45900000">
 *           <h6 class="actNm">Artist Name</h6>
 *           <p class="actTime">12:00 - 12:45</p>
 *         </div>
 *       </div>
 *     </div>
 *   </div>
 *
 * data-day:   unix ms timestamp of the day (midnight UTC)
 * data-start: ms from midnight for act start
 * data-end:   ms from midnight for act end
 */
export function parseClashfinderHtml(html: string, slug: string): ClashfinderResult {
	// Extract festival title from JS config
	const titleMatch = html.match(/festName:\s*"([^"]+)"/);
	const title = titleMatch?.[1] ?? humanizeSlug(slug);

	const acts: Act[] = [];

	// Parse each day block
	const dayRegex = /<div\s+class="day"[^>]*data-day="(\d+)"[^>]*>([\s\S]*?)(?=<div\s+class="day"|<\/div>\s*<!--\s*class="days"\s*-->)/g;
	let dayMatch;
	while ((dayMatch = dayRegex.exec(html)) !== null) {
		const dayTimestamp = Number(dayMatch[1]);
		const dayHtml = dayMatch[2];

		// Parse each stage container within the day
		const stageRegex = /<p\s+class="stageName">([^<]+)<\/p>([\s\S]*?)(?=<div\s+class="stageContainer"|<div\s+class="timeLineHide"|$)/g;
		let stageMatch;
		while ((stageMatch = stageRegex.exec(dayHtml)) !== null) {
			const stageName = stageMatch[1].trim();
			const stageHtml = stageMatch[2];

			// Parse each act within the stage
			const actRegex = /data-start="(\d+)"\s+data-end="(\d+)"[^>]*>[\s\S]*?<h6\s+class="actNm">([^<]+)<\/h6>/g;
			let actMatch;
			while ((actMatch = actRegex.exec(stageHtml)) !== null) {
				const startMs = Number(actMatch[1]);
				const endMs = Number(actMatch[2]);
				const actName = decodeHtmlEntities(actMatch[3].trim());

				const startTime = msToLocalIso(dayTimestamp, startMs);
				const endTime = msToLocalIso(dayTimestamp, endMs);

				acts.push({ name: actName, stage: stageName, startTime, endTime });
			}
		}
	}

	if (acts.length === 0) {
		throw new Error(
			'No acts found on the Clashfinder page. The lineup may not be published yet.'
		);
	}

	return { title, acts };
}

/**
 * Convert a day timestamp (unix ms, midnight) + offset from midnight (ms)
 * into a local ISO datetime string like "2026-07-11T14:30".
 */
function msToLocalIso(dayTimestampMs: number, offsetMs: number): string {
	const d = new Date(dayTimestampMs + offsetMs);
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	const hours = String(d.getUTCHours()).padStart(2, '0');
	const minutes = String(d.getUTCMinutes()).padStart(2, '0');
	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function decodeHtmlEntities(s: string): string {
	return s
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'");
}

function humanizeSlug(slug: string): string {
	return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
