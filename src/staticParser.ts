import type { Page } from "playwright";

const API_URL_REGEX =
	/https:\/\/api\.nasdaq\.com\/api\/[a-zA-Z0-9/\-_.?&=%{}]+/g;

/**
 * Scans all loaded JS resources on the current page for hardcoded api.nasdaq.com/api/ URLs.
 * Returns unique raw URL strings found in JS source (templates may be partial).
 */
export async function extractStaticApiUrls(page: Page): Promise<string[]> {
	// Collect all script URLs loaded on the page
	const scriptUrls: string[] = await page.evaluate(() => {
		return Array.from(document.querySelectorAll("script[src]"))
			.map((s) => (s as HTMLScriptElement).src)
			.filter((src) => src.startsWith("http"));
	});

	const found = new Set<string>();

	// Also scan inline scripts
	const inlineScripts: string[] = await page.evaluate(() => {
		return Array.from(document.querySelectorAll("script:not([src])")).map(
			(s) => s.textContent ?? "",
		);
	});

	for (const text of inlineScripts) {
		for (const match of text.matchAll(API_URL_REGEX)) {
			found.add(cleanUrl(match[0]));
		}
	}

	// Fetch each external JS bundle via the browser's fetch (already cached)
	for (const scriptUrl of scriptUrls) {
		try {
			const source = await page.evaluate(
				(url) => fetch(url).then((r) => (r.ok ? r.text() : "")),
				scriptUrl,
			);

			for (const match of source.matchAll(API_URL_REGEX)) {
				found.add(cleanUrl(match[0]));
			}
		} catch {
			// Non-critical: skip scripts that fail to load
		}
	}

	return Array.from(found);
}

/** Strip trailing junk characters that the regex may have over-captured */
function cleanUrl(raw: string): string {
	// Remove trailing quotes, backticks, parens, commas
	return raw.replace(/[`"'(),;\s]+$/, "");
}
