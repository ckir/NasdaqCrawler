import {
	type Browser,
	type BrowserContext,
	chromium,
	type Page,
	type Response,
} from "playwright";
import { config } from "./config";
import { dismissConsentDialog } from "./consentHandler";
import { randomDelay } from "./humanEmulation";
import { clearState, loadState, saveState } from "./state";
import { extractStaticApiUrls } from "./staticParser";
import {
	loadFileLinksFile,
	loadOutputFile,
	saveFileLinksFile,
	saveOutputFile,
	upsertEndpoint,
	upsertFileLink,
} from "./storage";
import type {
	ApiEndpoint,
	FileLink,
	FileLinksOutputFile,
	OutputFile,
} from "./types";
import {
	buildPatternMap,
	extractApiPath,
	isNasdaqApiUrl,
	matchOrCreatePattern,
} from "./urlPattern";

const NASDAQ_ORIGIN_RE = /^https?:\/\/(www\.)?nasdaq\.com/i;
// Skip locale-prefixed paths — same structure as English, no new API patterns
const LOCALE_PATH_RE = /^\/(?:sv|fi|da|no|nb|is|et|lv|lt)\//i;
const MAX_VISITS_PER_PAGE_PATTERN = 3;

// Path prefixes and substrings that yield no API endpoints — skip at enqueue time
const BLOCKED_PATH_PREFIXES = [
	// Explicitly excluded by user
	"/insights",
	"/solutions",
	"/about",
	"/articles",
	"/topic",
	"/videos",
	"/news-and-insights",
	"/events",
	"/newsroom",
	"/glossary",
	"/TradeTalks",
	"/plus",
	"/nasdaqmacroplus",
	"/european-market-activity",
	"/market-regulation",
	// Zero-yield content/corporate paths
	"/authors",
	"/contact-us",
	"/advertising",
	"/user",
	"/campaign",
	"/legal",
	"/taxonomy",
	"/newsletters",
	"/docs",
	"/static-files",
	"/marketsite",
	"/corporate-governance",
	"/news-releases",
	"/sign-up",
	"/node",
	"/sponsored",
	"/cookie-statement",
	"/terms",
	"/article",
	"/eip",
	"/sustainability",
	"/environmental-social-and-governance",
	"/esg",
	"/investor-relations",
	"/diversity-inclusion-and-belonging",
	"/market-technology",
	"/data-link",
	"/index-services",
	"/trust-center",
	"/accessibility",
	"/privacy-statement",
	"/search",
	"/account",
	"/brand",
	"/nasdaq-centers",
	"/nasdaq-foundation",
	"/nasdaq-center-for-board-excellence",
	"/market-data-services",
	"/market-data",
	"/trading-services",
	"/listing-center",
	"/global-listing-services",
	"/capital-access-platforms",
	"/financial-technology",
	"/nordic",
	"/dubai",
	"/nasdaq-texas",
	"/help",
	"/contact",
	"/privacy",
	"/cookies",
	"/security",
	"/complexity-report",
	"/ambition",
	"/education",
	"/social",
	"/homepage",
	"/news",
	"/blog",
	"/press-center",
	"/careers",
	"/partners",
	"/resources",
	"/market-activity/quotes",
	"/market-activity/crypto",
];
const BLOCKED_HOSTNAMES = new Set(["signin.nasdaq.com"]);
const BLOCKED_PATH_SUBSTRINGS = ["option"];
const BLOCKED_EXTENSIONS =
	/\.(pdf|docx?|xlsx?|pptx?|zip|csv|xml|txt|png|jpe?g|gif|svg|ico|woff2?|ttf|mp4|mp3|js|css|json)$/i;

export function isBlockedPath(pathname: string): boolean {
	const lower = pathname.toLowerCase();
	if (
		BLOCKED_PATH_PREFIXES.some((p) => lower === p || lower.startsWith(`${p}/`))
	)
		return true;
	if (BLOCKED_PATH_SUBSTRINGS.some((s) => lower.includes(s))) return true;
	if (BLOCKED_EXTENSIONS.test(lower)) return true;
	return false;
}

const SAMPLE_ARRAY_LIMIT = 2;

/** Recursively truncate all arrays in a response sample to at most SAMPLE_ARRAY_LIMIT items. */
function truncateSampleArrays(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.slice(0, SAMPLE_ARRAY_LIMIT).map(truncateSampleArrays);
	}
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([k, v]) => [
				k,
				truncateSampleArrays(v),
			]),
		);
	}
	return value;
}

// Path segments that introduce a symbol/ticker in the next position
const SYMBOL_BEARER_SEGS = new Set([
	"stocks",
	"etf",
	"mutual-fund",
	"index",
	"indexes",
	"crypto",
	"cryptocurrency",
	"quote",
	"fund",
	"funds",
]);

/** Collapse a page URL to a structural pattern for visit-count throttling. */
function pageUrlPattern(url: string): string {
	try {
		const u = new URL(url);
		const rawSegs = u.pathname.split("/").filter(Boolean);
		const segments = rawSegs.map((seg, i) => {
			const prev = rawSegs[i - 1] ?? "";
			if (
				/^[A-Z]{1,6}$/.test(seg) || // uppercase ticker
				/^\d+$/.test(seg) || // numeric ID
				seg.length > 12 || // long hash/slug
				(SYMBOL_BEARER_SEGS.has(prev) && /^[a-zA-Z]{1,6}$/.test(seg)) // lowercase ticker after bearer
			)
				return "{v}";
			return seg;
		});
		return `${u.hostname}/${segments.join("/")}`;
	} catch {
		return url;
	}
}

let isShuttingDown = false;

export function signalShutdown(): void {
	if (isShuttingDown) return;
	isShuttingDown = true;
	console.log(
		"\n[crawler] Shutdown signal received. Finishing current page and stopping...",
	);
}

export async function runCrawler(): Promise<void> {
	const data: OutputFile = loadOutputFile();
	const fileLinksData: FileLinksOutputFile = loadFileLinksFile();
	const patternMap = buildPatternMap(Object.keys(data.endpoints));

	const savedState = loadState();
	const visitedPages = savedState?.visitedPages ?? new Set<string>();
	const pagePatternVisits =
		savedState?.pagePatternVisits ?? new Map<string, number>();
	const pageQueue: string[] = savedState?.pageQueue ?? [config.startUrl];
	let pagesProcessed = 0;

	console.log(
		`[crawler] Loaded ${Object.keys(data.endpoints).length} known patterns from output file.`,
	);
	if (!savedState)
		console.log(`[crawler] Starting crawl from ${config.startUrl}`);
	if (config.testMode)
		console.log(`[crawler] TEST MODE: limit ${config.testLimit} pages`);

	const browser: Browser = await chromium.launch({
		headless: config.headless,
		args: [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-blink-features=AutomationControlled",
			"--use-fake-ui-for-media-stream",
			"--use-fake-device-for-media-stream",
			"--disable-infobars",
		],
	});

	const context: BrowserContext = await browser.newContext({
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		viewport: { width: 1920, height: 1080 },
		deviceScaleFactor: 1,
		hasTouch: false,
		isMobile: false,
		locale: "en-US",
		timezoneId: "America/New_York",
	});

	// Intercept all network responses to api.nasdaq.com/api/
	const pendingResponses = new Map<string, { url: string; body: unknown }>();

	context.on("response", async (response: Response) => {
		const url = response.url();
		if (!isNasdaqApiUrl(url)) return;

		const contentType = response.headers()["content-type"] ?? "";
		if (!contentType.includes("application/json")) return;

		try {
			const body = await response.json();
			pendingResponses.set(url, { url, body });
		} catch {
			// Non-JSON or empty body — skip
		}
	});

	try {
		while (pageQueue.length > 0 && !isShuttingDown) {
			if (config.testMode && pagesProcessed >= config.testLimit) {
				console.log(
					`[crawler] Test limit reached (${config.testLimit} pages). Stopping.`,
				);
				break;
			}

			const pageUrl = pageQueue.shift();
			if (!pageUrl) continue;
			const normalizedPageUrl = normalizeUrl(pageUrl);
			if (visitedPages.has(normalizedPageUrl)) continue;

			// Skip if we've already visited enough pages with this structural pattern
			const pagePat = pageUrlPattern(normalizedPageUrl);
			const patVisits = pagePatternVisits.get(pagePat) ?? 0;
			if (patVisits >= MAX_VISITS_PER_PAGE_PATTERN) continue;
			pagePatternVisits.set(pagePat, patVisits + 1);

			visitedPages.add(normalizedPageUrl);
			pagesProcessed++;

			console.log(`\n[crawler] [${pagesProcessed}] Visiting: ${pageUrl}`);

			const page: Page = await context.newPage();
			pendingResponses.clear();

			try {
				await page.setExtraHTTPHeaders({
					"Accept-Language": "en-US,en;q=0.9",
					Accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
					"Sec-Ch-Ua":
						'"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
					"Sec-Ch-Ua-Mobile": "?0",
					"Sec-Ch-Ua-Platform": '"Windows"',
				});
				await page.goto(pageUrl, {
					waitUntil: "load",
					timeout: 30000,
				});
			} catch (err) {
				console.warn(
					`[crawler] Failed to load ${pageUrl}: ${(err as Error).message}`,
				);
				await page.close();
				continue;
			}

			// Dismiss cookie/privacy consent banner if present
			await dismissConsentDialog(page);

			// Wait for JS-driven API calls to fire after DOM is ready
			await randomDelay();

			const pageTitle = await page.title().catch(() => "");

			// --- Process intercepted network responses ---
			let networkNew = 0;
			for (const { url, body } of pendingResponses.values()) {
				const apiPath = extractApiPath(url);
				const { pattern } = matchOrCreatePattern(apiPath, patternMap);
				const endpoint: ApiEndpoint = {
					pattern,
					exampleUrl: url,
					method: "GET",
					source: "network",
					responseSample: truncateSampleArrays(body),
					firstSeenAt: new Date().toISOString(),
					seenOnPages: [{ url: pageUrl, title: pageTitle }],
				};
				const added = upsertEndpoint(data, endpoint);
				if (added) networkNew++;
			}
			if (networkNew > 0) {
				console.log(
					`[crawler]   +${networkNew} new API patterns from network interception`,
				);
				saveOutputFile(data);
			}

			// --- Static JS parsing ---
			let staticNew = 0;
			try {
				const staticUrls = await extractStaticApiUrls(page);
				for (const rawUrl of staticUrls) {
					if (!isNasdaqApiUrl(rawUrl)) continue;
					const apiPath = extractApiPath(rawUrl);
					const { pattern, isNew } = matchOrCreatePattern(apiPath, patternMap);
					if (isNew) {
						const endpoint: ApiEndpoint = {
							pattern,
							exampleUrl: rawUrl,
							method: "GET",
							source: "static",
							responseSample: null,
							firstSeenAt: new Date().toISOString(),
							seenOnPages: [{ url: pageUrl, title: pageTitle }],
						};
						upsertEndpoint(data, endpoint);
						staticNew++;
					}
				}
				if (staticNew > 0) {
					console.log(
						`[crawler]   +${staticNew} new API patterns from static JS parsing`,
					);
					saveOutputFile(data);
				}
			} catch (err) {
				console.warn(
					`[crawler]   Static parse error: ${(err as Error).message}`,
				);
			}

			// --- Discover same-domain links ---
			let links: string[] = [];
			try {
				links = await page.evaluate(() => {
					return Array.from(document.querySelectorAll("a[href]"))
						.map((a) => (a as HTMLAnchorElement).href)
						.filter((h) => h.startsWith("http"));
				});
			} catch {
				// Page may have navigated away or closed — skip link discovery
			}

			let newLinksFound = 0;
			let newFileLinksFound = 0;
			for (const link of links) {
				const normalized = normalizeUrl(link);
				let pathname: string;
				let hostname: string;
				try {
					const u = new URL(normalized);
					pathname = u.pathname;
					hostname = u.hostname;
				} catch {
					continue;
				}

				// --- File Link Discovery ---
				const ext = pathname.split(".").pop()?.toLowerCase() || "";
				if (
					NASDAQ_ORIGIN_RE.test(link) &&
					config.fileExtensions.includes(ext)
				) {
					const fileLink: FileLink = {
						url: normalized,
						extension: ext,
						seenOnPages: [{ url: pageUrl, title: pageTitle }],
					};
					if (upsertFileLink(fileLinksData, fileLink)) {
						newFileLinksFound++;
					}
				}

				if (BLOCKED_HOSTNAMES.has(hostname)) continue;
				if (LOCALE_PATH_RE.test(pathname) || isBlockedPath(pathname)) continue;
				// Skip enqueueing if this URL's pattern is already at visit limit
				if (
					(pagePatternVisits.get(pageUrlPattern(normalized)) ?? 0) >=
					MAX_VISITS_PER_PAGE_PATTERN
				)
					continue;
				if (
					NASDAQ_ORIGIN_RE.test(link) &&
					!visitedPages.has(normalized) &&
					!pageQueue.includes(normalized)
				) {
					pageQueue.push(normalized);
					newLinksFound++;
				}
			}
			console.log(
				`[crawler]   Discovered ${newLinksFound} new pages to visit (queue: ${pageQueue.length})`,
			);
			if (newFileLinksFound > 0) {
				console.log(`[crawler]   +${newFileLinksFound} new file links found`);
				saveFileLinksFile(fileLinksData);
			}

			await page.close();
			saveState(visitedPages, pageQueue, pagePatternVisits);
			await randomDelay();
		}
	} finally {
		await browser.close();
	}

	if (isShuttingDown) {
		console.log(
			`[crawler] Stopped by user. State saved. Visited ${pagesProcessed} pages.`,
		);
	} else {
		console.log(
			`\n[crawler] Done. Visited ${pagesProcessed} pages. Total patterns: ${Object.keys(data.endpoints).length}`,
		);
		saveOutputFile(data);
		saveFileLinksFile(fileLinksData);
		clearState();
	}
}

function normalizeUrl(url: string): string {
	try {
		const u = new URL(url);
		// Strip fragment, trailing slash
		u.hash = "";
		return u.toString().replace(/\/$/, "");
	} catch {
		return url;
	}
}
