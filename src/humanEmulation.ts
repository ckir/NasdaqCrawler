import { config } from "./config";

export function randomDelay(): Promise<void> {
	const ms =
		config.minDelayMs +
		Math.floor(Math.random() * (config.maxDelayMs - config.minDelayMs));
	return new Promise((resolve) => setTimeout(resolve, ms));
}
