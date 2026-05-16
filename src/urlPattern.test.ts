import {
	buildPatternMap,
	extractApiPath,
	isNasdaqApiUrl,
	matchOrCreatePattern,
} from "./urlPattern";

describe("urlPattern", () => {
	describe("extractApiPath", () => {
		it("should extract path from valid URL", () => {
			expect(
				extractApiPath(
					"https://api.nasdaq.com/api/quote/AAPL/info?assetclass=stocks",
				),
			).toBe("/api/quote/AAPL/info");
		});

		it("should return same string if not a URL", () => {
			expect(extractApiPath("/api/test")).toBe("/api/test");
		});
	});

	describe("isNasdaqApiUrl", () => {
		it("should return true for nasdaq API urls", () => {
			expect(isNasdaqApiUrl("https://api.nasdaq.com/api/v1/test")).toBe(true);
		});

		it("should return false for other urls", () => {
			expect(isNasdaqApiUrl("https://www.nasdaq.com/api")).toBe(false);
			expect(isNasdaqApiUrl("https://google.com")).toBe(false);
		});
	});

	describe("matchOrCreatePattern", () => {
		it("should exact match existing patterns", () => {
			const map = buildPatternMap(["/api/quote/info"]);
			const { pattern, isNew } = matchOrCreatePattern("/api/quote/info", map);
			expect(pattern).toBe("/api/quote/info");
			expect(isNew).toBe(false);
		});

		it("should match pattern with {var}", () => {
			const map = buildPatternMap(["/api/quote/{var}/info"]);
			const { pattern, isNew } = matchOrCreatePattern(
				"/api/quote/AAPL/info",
				map,
			);
			expect(pattern).toBe("/api/quote/{var}/info");
			expect(isNew).toBe(false);
		});

		it("should merge compatible paths into {var}", () => {
			const map = buildPatternMap(["/api/quote/AAPL/info"]);
			const { pattern, isNew } = matchOrCreatePattern(
				"/api/quote/MSFT/info",
				map,
			);
			expect(pattern).toBe("/api/quote/{var}/info");
			expect(isNew).toBe(false);
			expect(map.has("/api/quote/{var}/info")).toBe(true);
			expect(map.has("/api/quote/AAPL/info")).toBe(false);
		});

		it("should return new pattern if no match or merge found", () => {
			const map = buildPatternMap(["/api/quote/AAPL/info"]);
			const { pattern, isNew } = matchOrCreatePattern("/api/other/test", map);
			expect(pattern).toBe("/api/other/test");
			expect(isNew).toBe(true);
		});
	});
});
