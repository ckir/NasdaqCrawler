export interface PageRef {
	url: string;
	title: string;
}

export interface ApiEndpoint {
	pattern: string; // collapsed URL pattern e.g. /api/quote/{var}/info
	exampleUrl: string; // one concrete URL that matched this pattern
	method: string;
	source: "network" | "static" | "both";
	responseSample: unknown; // full JSON response body
	firstSeenAt: string; // ISO timestamp
	seenOnPages: PageRef[]; // pages where this was encountered
}

export interface OutputFile {
	version: number;
	updatedAt: string;
	endpoints: Record<string, ApiEndpoint>; // keyed by pattern
}

export interface FileLink {
	url: string;
	extension: string;
	seenOnPages: PageRef[];
}

export interface FileLinksOutputFile {
	version: number;
	updatedAt: string;
	links: Record<string, FileLink>; // keyed by URL
}
