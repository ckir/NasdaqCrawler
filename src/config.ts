import * as path from "node:path";
import { config as envx } from "@dotenvx/dotenvx";

envx({ overload: true });

function getInt(key: string, fallback: number): number {
	const val = process.env[key];
	const parsed = val !== undefined ? parseInt(val, 10) : NaN;
	return Number.isNaN(parsed) ? fallback : parsed;
}

function getBool(key: string, fallback: boolean): boolean {
	const val = process.env[key];
	if (val === undefined) return fallback;
	return val.toLowerCase() === "true";
}

const outputFile = path.resolve(
	process.env.OUTPUT_FILE ?? "./output/api-endpoints.json",
);

const defaultOutputFile = path.resolve(
	path.dirname(outputFile),
	"api-endpoints-default.json",
);

export const config = {
	headless: getBool("HEADLESS", false),
	defaultOutputFile,
	testMode: getBool("TEST_MODE", false),
	testLimit: getInt("TEST_LIMIT", 2),
	outputFile,
	fileLinksOutputFile: path.resolve(
		path.dirname(outputFile),
		"file-links.json",
	),
	fileExtensions: (process.env.FILE_EXTENSIONS ?? "csv,xlsx")
		.split(",")
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean),
	minDelayMs: getInt("MIN_DELAY_MS", 1500),
	maxDelayMs: getInt("MAX_DELAY_MS", 4500),
	startUrl: process.env.START_URL ?? "https://www.nasdaq.com",
	apiPrefix: "https://api.nasdaq.com/api/",
	targetDomain: "nasdaq.com",
};
