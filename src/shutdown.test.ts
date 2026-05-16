import {
	type Browser,
	type BrowserContext,
	chromium,
	type Page,
} from "playwright";
import { runCrawler, signalShutdown } from "./crawler";

jest.mock("playwright", () => ({
	chromium: {
		launch: jest.fn(),
	},
}));

jest.mock("./storage", () => ({
	loadOutputFile: jest.fn().mockReturnValue({ endpoints: {} }),
	saveOutputFile: jest.fn(),
	upsertEndpoint: jest.fn(),
	loadFileLinksFile: jest.fn().mockReturnValue({ links: {} }),
	saveFileLinksFile: jest.fn(),
}));

jest.mock("./state", () => ({
	loadState: jest.fn().mockReturnValue({
		visitedPages: new Set(),
		pageQueue: ["https://www.nasdaq.com"],
		pagePatternVisits: new Map(),
	}),
	saveState: jest.fn(),
	clearState: jest.fn(),
}));

jest.mock("./config", () => ({
	config: {
		startUrl: "https://www.nasdaq.com",
		headless: true,
		testMode: false,
		outputFile: "output/test.json",
		minDelayMs: 10,
		maxDelayMs: 20,
		fileExtensions: ["csv", "xlsx"],
		fileLinksOutputFile: "output/test-file-links.json",
	},
}));

describe("Graceful Shutdown", () => {
	it("should stop crawling when signalShutdown is called", async () => {
		const logSpy = jest.spyOn(console, "log").mockImplementation();

		const mockPage = {
			goto: jest.fn().mockResolvedValue({}),
			close: jest.fn().mockResolvedValue({}),
			title: jest.fn().mockResolvedValue("Test Page"),
			evaluate: jest.fn().mockResolvedValue([]),
		} as unknown as Page;

		const mockContext = {
			on: jest.fn(),
			newPage: jest.fn().mockImplementation(() => {
				// Signal shutdown when a new page is created
				// This simulates the interrupt happening during the loop
				signalShutdown();
				return Promise.resolve(mockPage);
			}),
			close: jest.fn().mockResolvedValue({}),
		} as unknown as BrowserContext;

		const mockBrowser = {
			newContext: jest.fn().mockResolvedValue(mockContext),
			close: jest.fn().mockResolvedValue({}),
		} as unknown as Browser;

		const mockChromium = chromium as jest.Mocked<typeof chromium>;
		mockChromium.launch.mockResolvedValue(mockBrowser);

		await runCrawler();

		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("Shutdown signal received"),
		);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("Stopped by user"),
		);

		expect(mockBrowser.close).toHaveBeenCalled();

		logSpy.mockRestore();
	});
});
