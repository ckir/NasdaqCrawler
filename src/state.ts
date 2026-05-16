import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "./config";
import { isBlockedPath } from "./crawler";

const stateFile = path.resolve(
	path.dirname(config.outputFile),
	"crawler-state.json",
);

interface CrawlerState {
	visitedPages: string[];
	pageQueue: string[];
	pagePatternVisits: Record<string, number>;
}

export interface LoadedState {
	visitedPages: Set<string>;
	pageQueue: string[];
	pagePatternVisits: Map<string, number>;
}

function isUrlBlocked(url: string): boolean {
	try {
		const u = new URL(url);
		return isBlockedPath(u.pathname);
	} catch {
		return false;
	}
}

function isPatternBlocked(pattern: string): boolean {
	const parts = pattern.split("/");
	const path = `/${parts.slice(1).join("/")}`;
	return isBlockedPath(path);
}

export function loadState(): LoadedState | null {
	if (!fs.existsSync(stateFile)) return null;
	try {
		const raw = JSON.parse(fs.readFileSync(stateFile, "utf-8")) as CrawlerState;

		// Filter out blacklisted entries during load
		const visitedPages = raw.visitedPages.filter((u) => !isUrlBlocked(u));
		const pageQueue = raw.pageQueue.filter((u) => !isUrlBlocked(u));
		const pagePatternVisits = new Map<string, number>();

		for (const [pattern, count] of Object.entries(raw.pagePatternVisits)) {
			if (!isPatternBlocked(pattern)) {
				pagePatternVisits.set(pattern, count);
			}
		}

		const removedVisited = raw.visitedPages.length - visitedPages.length;
		const removedQueue = raw.pageQueue.length - pageQueue.length;

		if (removedVisited > 0 || removedQueue > 0) {
			console.log(
				`[state] Filtered blacklisted: removed ${removedVisited} visited, ${removedQueue} queued.`,
			);
		}

		console.log(
			`[state] Resuming: ${visitedPages.length} visited, ${pageQueue.length} queued.`,
		);

		return {
			visitedPages: new Set(visitedPages),
			pageQueue,
			pagePatternVisits,
		};
	} catch {
		console.warn("[state] Could not parse state file, starting fresh.");
		return null;
	}
}

export function saveState(
	visitedPages: Set<string>,
	pageQueue: string[],
	pagePatternVisits: Map<string, number>,
): void {
	const state: CrawlerState = {
		visitedPages: Array.from(visitedPages),
		pageQueue,
		pagePatternVisits: Object.fromEntries(pagePatternVisits),
	};
	fs.writeFileSync(stateFile, JSON.stringify(state), "utf-8");
}

export function clearState(): void {
	if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
}
