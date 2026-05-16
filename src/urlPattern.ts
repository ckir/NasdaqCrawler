const _API_BASE = "https://api.nasdaq.com/api";

/**
 * Given a full API URL, returns just the path portion starting with /api/...
 * e.g. https://api.nasdaq.com/api/quote/AAPL/info?assetclass=stocks -> /api/quote/AAPL/info
 */
export function extractApiPath(url: string): string {
	try {
		const u = new URL(url);
		return u.pathname;
	} catch {
		return url;
	}
}

/**
 * A variable segment is purely alphanumeric, at least 1 char, and NOT a common
 * static word (all lowercase with no digits). Typical variables: AAPL, 123456,
 * MSFT, Q3-2024, etc.
 */
function isLikelyVariable(segment: string): boolean {
	// All-uppercase ticker-like or mixed alphanumeric with digits or dashes
	if (/^[A-Z]{1,5}$/.test(segment)) return true; // tickers
	if (/^[A-Z0-9-]{2,}$/.test(segment)) return true; // IDs with digits/dashes
	if (/^\d+$/.test(segment)) return true; // pure numeric IDs
	if (/^[a-zA-Z0-9]{8,}$/.test(segment)) return true; // long alphanumeric slugs
	return false;
}

/**
 * Try to collapse two path arrays into a single pattern.
 * Returns the pattern segments if they can be merged, null if they are incompatible.
 * Two paths merge when they have the same length and differ only in segments
 * that look like variables.
 */
function tryMerge(a: string[], b: string[]): string[] | null {
	if (a.length !== b.length) return null;
	const result: string[] = [];
	for (let i = 0; i < a.length; i++) {
		if (a[i] === b[i]) {
			result.push(a[i]);
		} else if (isLikelyVariable(a[i]) && isLikelyVariable(b[i])) {
			result.push("{var}");
		} else if (a[i] === "{var}") {
			result.push("{var}");
		} else {
			return null; // incompatible
		}
	}
	return result;
}

/**
 * Given a new concrete API path and the set of existing patterns (as path segment arrays),
 * returns the pattern string that the new path matches or can be merged into,
 * or null if it's genuinely new.
 *
 * Side-effects: may update existingPatternSegments in-place if a merge is performed.
 */
export function matchOrCreatePattern(
	newPath: string,
	existingPatterns: Map<string, string[]>,
): { pattern: string; isNew: boolean } {
	const newSegments = newPath.split("/").filter(Boolean);

	// 1. Exact match against existing patterns (including wildcarded ones)
	for (const [patternStr, patternSegs] of existingPatterns) {
		if (patternSegs.length !== newSegments.length) continue;
		let matches = true;
		for (let i = 0; i < patternSegs.length; i++) {
			if (patternSegs[i] !== "{var}" && patternSegs[i] !== newSegments[i]) {
				matches = false;
				break;
			}
		}
		if (matches) return { pattern: patternStr, isNew: false };
	}

	// 2. Try to merge with an existing concrete pattern
	for (const [patternStr, patternSegs] of existingPatterns) {
		const merged = tryMerge(patternSegs, newSegments);
		if (merged) {
			const newPatternStr = `/${merged.join("/")}`;
			// Replace old pattern entry with merged one
			existingPatterns.delete(patternStr);
			existingPatterns.set(newPatternStr, merged);
			return { pattern: newPatternStr, isNew: false };
		}
	}

	// 3. Genuinely new pattern
	const patternStr = `/${newSegments.join("/")}`;
	existingPatterns.set(patternStr, newSegments);
	return { pattern: patternStr, isNew: true };
}

/**
 * Build the initial pattern map from already-known patterns in the output file.
 */
export function buildPatternMap(
	knownPatterns: string[],
): Map<string, string[]> {
	const map = new Map<string, string[]>();
	for (const p of knownPatterns) {
		map.set(p, p.split("/").filter(Boolean));
	}
	return map;
}

export function isNasdaqApiUrl(url: string): boolean {
	return url.startsWith("https://api.nasdaq.com/api/");
}
