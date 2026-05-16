import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "./config";
import type { ApiEndpoint, OutputFile, PageRef } from "./types";

const CURRENT_VERSION = 1;

export function loadOutputFile(): OutputFile {
	if (fs.existsSync(config.outputFile)) {
		try {
			const raw = fs.readFileSync(config.outputFile, "utf-8");
			return JSON.parse(raw) as OutputFile;
		} catch {
			console.warn(
				"[storage] Could not parse existing output file, starting fresh.",
			);
		}
	}
	return {
		version: CURRENT_VERSION,
		updatedAt: new Date().toISOString(),
		endpoints: {},
	};
}

export function saveOutputFile(data: OutputFile): void {
	const dir = path.dirname(config.outputFile);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	data.updatedAt = new Date().toISOString();
	fs.writeFileSync(config.outputFile, JSON.stringify(data, null, 2), "utf-8");
}

export function upsertEndpoint(
	data: OutputFile,
	endpoint: ApiEndpoint,
): boolean {
	const existing = data.endpoints[endpoint.pattern];
	if (existing) {
		// Merge new page references but don't overwrite the sample
		for (const page of endpoint.seenOnPages) {
			if (!existing.seenOnPages.some((p: PageRef) => p.url === page.url)) {
				existing.seenOnPages.push(page);
			}
		}
		if (existing.source !== endpoint.source && existing.source !== "both") {
			existing.source = "both";
		}
		return false; // already had this pattern
	}
	data.endpoints[endpoint.pattern] = endpoint;
	return true; // newly added
}
