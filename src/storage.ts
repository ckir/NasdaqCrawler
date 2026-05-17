import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "./config";
import type {
	ApiEndpoint,
	FileLink,
	FileLinksOutputFile,
	OutputFile,
	PageRef,
} from "./types";

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
	if (fs.existsSync(config.defaultOutputFile)) {
		try {
			const raw = fs.readFileSync(config.defaultOutputFile, "utf-8");
			console.log("[storage] No output file found — seeding from default.");
			return JSON.parse(raw) as OutputFile;
		} catch {
			console.warn(
				"[storage] Could not parse default output file, starting fresh.",
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

export function loadFileLinksFile(): FileLinksOutputFile {
	if (fs.existsSync(config.fileLinksOutputFile)) {
		try {
			const raw = fs.readFileSync(config.fileLinksOutputFile, "utf-8");
			return JSON.parse(raw) as FileLinksOutputFile;
		} catch {
			console.warn(
				"[storage] Could not parse existing file links file, starting fresh.",
			);
		}
	}
	return {
		version: CURRENT_VERSION,
		updatedAt: new Date().toISOString(),
		links: {},
	};
}

export function saveFileLinksFile(data: FileLinksOutputFile): void {
	const dir = path.dirname(config.fileLinksOutputFile);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	data.updatedAt = new Date().toISOString();
	fs.writeFileSync(
		config.fileLinksOutputFile,
		JSON.stringify(data, null, 2),
		"utf-8",
	);
}

export function upsertEndpoint(
	data: OutputFile,
	endpoint: ApiEndpoint,
): boolean {
	const existing = data.endpoints[endpoint.pattern];
	if (existing) {
		// Merge new page references; fill in sample only if it was never captured
		for (const page of endpoint.seenOnPages) {
			if (!existing.seenOnPages.some((p: PageRef) => p.url === page.url)) {
				existing.seenOnPages.push(page);
			}
		}
		if (existing.responseSample === null && endpoint.responseSample !== null) {
			existing.responseSample = endpoint.responseSample;
		}
		if (existing.source !== endpoint.source && existing.source !== "both") {
			existing.source = "both";
		}
		return false; // already had this pattern
	}
	data.endpoints[endpoint.pattern] = endpoint;
	return true; // newly added
}

export function upsertFileLink(
	data: FileLinksOutputFile,
	link: FileLink,
): boolean {
	const existing = data.links[link.url];
	if (existing) {
		let added = false;
		for (const page of link.seenOnPages) {
			if (!existing.seenOnPages.some((p: PageRef) => p.url === page.url)) {
				existing.seenOnPages.push(page);
				added = true;
			}
		}
		return added;
	}
	data.links[link.url] = link;
	return true; // newly added
}
