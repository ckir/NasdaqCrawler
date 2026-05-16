import * as fs from "node:fs";
import * as path from "node:path";
import { clearState, loadState, saveState } from "./state";

jest.mock("./config", () => {
	const path = require("node:path");
	return {
		config: {
			outputFile: path.resolve("./test-output/api-endpoints.json"),
		},
	};
});

describe("state", () => {
	const testDir = path.resolve("./test-output");
	const stateFile = path.resolve(testDir, "crawler-state.json");

	beforeAll(() => {
		if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
	});

	afterAll(() => {
		if (fs.existsSync(testDir))
			fs.rmSync(testDir, { recursive: true, force: true });
	});

	beforeEach(() => {
		if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
	});

	it("should return null if no state file exists", () => {
		expect(loadState()).toBeNull();
	});

	it("should save and load state", () => {
		const visitedPages = new Set(["http://page1"]);
		const pageQueue = ["http://page2"];
		const pagePatternVisits = new Map([["pattern1", 1]]);

		saveState(visitedPages, pageQueue, pagePatternVisits);
		const loaded = loadState();

		expect(loaded).not.toBeNull();
		if (loaded) {
			expect(loaded.visitedPages.has("http://page1")).toBe(true);
			expect(loaded.pageQueue).toEqual(["http://page2"]);
			expect(loaded.pagePatternVisits.get("pattern1")).toBe(1);
		}
	});

	it("should clear state", () => {
		saveState(new Set(), [], new Map());
		expect(fs.existsSync(stateFile)).toBe(true);
		clearState();
		expect(fs.existsSync(stateFile)).toBe(false);
	});
});
