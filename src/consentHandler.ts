import type { Page } from "playwright";

// OneTrust is the CMP used by nasdaq.com
const ACCEPT_SELECTORS = [
	"#onetrust-accept-btn-handler", // OneTrust primary accept
	"#accept-recommended-btn-handler", // OneTrust recommended settings
	'button[id*="onetrust"][id*="accept"]', // OneTrust fallback
	"button.cookie-consent__accept",
	'button[data-testid="cookie-accept"]',
];

export async function dismissConsentDialog(page: Page): Promise<void> {
	for (const selector of ACCEPT_SELECTORS) {
		try {
			const btn = page.locator(selector).first();
			const visible = await btn.isVisible({ timeout: 3000 });
			if (visible) {
				await btn.click();
				// Wait for the overlay to disappear
				await page
					.waitForSelector("#onetrust-consent-sdk", {
						state: "hidden",
						timeout: 5000,
					})
					.catch(() => {
						/* overlay may have a different id — that's fine */
					});
				console.log(`[consent] Dismissed dialog via "${selector}"`);
				return;
			}
		} catch {
			// Selector not present on this page — try next
		}
	}
}
