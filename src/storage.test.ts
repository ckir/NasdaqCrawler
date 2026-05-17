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
			defaultOutputFile: path.resolve(
				"./test-output/api-endpoints-default.json",
			),
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
			if (fs.existsSync(config.defaultOutputFile))
				fs.unlinkSync(config.defaultOutputFile);
			const data = loadOutputFile();
			expect(data.endpoints).toEqual({});
		});

		it("should seed from default file when output file does not exist", () => {
			if (fs.existsSync(config.outputFile)) fs.unlinkSync(config.outputFile);
			const seed = {
				version: 1,
				updatedAt: new Date().toISOString(),
				endpoints: {
					"/api/seed": {
						pattern: "/api/seed",
						exampleUrl: "https://api.nasdaq.com/api/seed",
						method: "GET",
						source: "network" as const,
						responseSample: { ok: true },
						firstSeenAt: new Date().toISOString(),
						seenOnPages: [],
					},
				},
			};
			fs.writeFileSync(config.defaultOutputFile, JSON.stringify(seed), "utf-8");
			const data = loadOutputFile();
			expect(data.endpoints["/api/seed"]).toBeDefined();
			fs.unlinkSync(config.defaultOutputFile);
		});

		it("should fill null responseSample when upserted with real data", () => {
			const data = loadOutputFile();
			const seeded = {
				pattern: "/api/fill",
				exampleUrl: "https://api.nasdaq.com/api/fill",
				method: "GET",
				source: "network" as const,
				responseSample: null,
				firstSeenAt: new Date().toISOString(),
				seenOnPages: [],
			};
			upsertEndpoint(data, seeded);
			const withSample = { ...seeded, responseSample: { value: 42 } };
			upsertEndpoint(data, withSample);
			expect(data.endpoints["/api/fill"].responseSample).toEqual({
				value: 42,
			});
		});

		it("should not overwrite existing responseSample on upsert", () => {
			const data = loadOutputFile();
			const original = {
				pattern: "/api/keep",
				exampleUrl: "https://api.nasdaq.com/api/keep",
				method: "GET",
				source: "network" as const,
				responseSample: { original: true },
				firstSeenAt: new Date().toISOString(),
				seenOnPages: [],
			};
			upsertEndpoint(data, original);
			const updated = { ...original, responseSample: { replaced: true } };
			upsertEndpoint(data, updated);
			expect(data.endpoints["/api/keep"].responseSample).toEqual({
				original: true,
			});
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
