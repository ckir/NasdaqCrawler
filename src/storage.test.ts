import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "./config";
import {
	loadFileLinksFile,
	loadOutputFile,
	saveFileLinksFile,
	saveOutputFile,
	upsertEndpoint,
	upsertFileLink,
} from "./storage";

jest.mock("./config", () => {
	const path = require("node:path");
	return {
		config: {
			outputFile: path.resolve("./test-output/api-endpoints.json"),
			fileLinksOutputFile: path.resolve("./test-output/file-links.json"),
		},
	};
});

describe("storage", () => {
	const testDir = path.resolve("./test-output");

	beforeAll(() => {
		if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
	});

	afterAll(() => {
		if (fs.existsSync(testDir))
			fs.rmSync(testDir, { recursive: true, force: true });
	});

	describe("API endpoints", () => {
		it("should load empty output file if not exists", () => {
			if (fs.existsSync(config.outputFile)) fs.unlinkSync(config.outputFile);
			const data = loadOutputFile();
			expect(data.endpoints).toEqual({});
		});

		it("should save and load output file", () => {
			const data = loadOutputFile();
			data.endpoints["/test"] = {
				pattern: "/test",
				exampleUrl: "http://test",
				method: "GET",
				source: "network",
				responseSample: {},
				firstSeenAt: new Date().toISOString(),
				seenOnPages: [],
			};
			saveOutputFile(data);
			const reloaded = loadOutputFile();
			expect(reloaded.endpoints["/test"]).toBeDefined();
		});

		it("should upsert endpoint", () => {
			const data = loadOutputFile();
			const endpoint = {
				pattern: "/new",
				exampleUrl: "http://new",
				method: "GET",
				source: "network" as const,
				responseSample: {},
				firstSeenAt: new Date().toISOString(),
				seenOnPages: [{ url: "http://page", title: "Title" }],
			};
			const added = upsertEndpoint(data, endpoint);
			expect(added).toBe(true);
			expect(data.endpoints["/new"]).toBeDefined();
		});
	});

	describe("File links", () => {
		it("should load empty file links if not exists", () => {
			if (fs.existsSync(config.fileLinksOutputFile))
				fs.unlinkSync(config.fileLinksOutputFile);
			const data = loadFileLinksFile();
			expect(data.links).toEqual({});
		});

		it("should save and load file links", () => {
			const data = loadFileLinksFile();
			data.links["http://test.csv"] = {
				url: "http://test.csv",
				extension: "csv",
				seenOnPages: [],
			};
			saveFileLinksFile(data);
			const reloaded = loadFileLinksFile();
			expect(reloaded.links["http://test.csv"]).toBeDefined();
		});

		it("should upsert file link", () => {
			const data = loadFileLinksFile();
			const link = {
				url: "http://new.xlsx",
				extension: "xlsx",
				seenOnPages: [{ url: "http://page", title: "Title" }],
			};
			const added = upsertFileLink(data, link);
			expect(added).toBe(true);
			expect(data.links["http://new.xlsx"]).toBeDefined();
		});
	});
});
