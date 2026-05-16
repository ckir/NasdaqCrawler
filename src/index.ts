import { runCrawler, signalShutdown } from "./crawler";

process.on("SIGINT", () => {
	signalShutdown();
});

process.on("SIGTERM", () => {
	signalShutdown();
});

runCrawler().catch((err) => {
	console.error("[fatal]", err);
	process.exit(1);
});
