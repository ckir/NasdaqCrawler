# Nasdaq API Crawler

An automated crawler designed to discover, map, and document the internal API endpoints used by `nasdaq.com`. It navigates the site, intercepts network requests, and performs static analysis on JavaScript files to build a comprehensive registry of API patterns and response samples.

## Key Features

- **Automated Discovery**: Recursively crawls `nasdaq.com` to find pages that trigger API calls.
- **API Pattern Mapping**: Automatically identifies and groups similar API endpoints (e.g., collapsing `/api/quote/AAPL/info` and `/api/quote/MSFT/info` into `/api/quote/{var}/info`).
- **Network Interception**: Captures real-time traffic to identify active endpoints and save representative response JSON samples.
- **Static Analysis**: Parses JavaScript bundles on the fly to find static references to API URLs.
- **Human Emulation**: Includes random delays and browser-like headers to minimize automated detection.
- **State Persistence**: Saves crawl state (visited pages, queue) to `state.json`, allowing you to resume interrupted crawls.
- **Blacklist & Throttling**: Intelligent path blacklisting (ignoring news/corporate pages) and structural throttling (limiting visits to similar page patterns like individual stock pages).

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (Recommended)

## Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

```bash
# Browser visibility
HEADLESS=false

# Test mode settings
TEST_MODE=false
TEST_LIMIT=2

# Output and Timing
OUTPUT_FILE=./output/api-endpoints.json
MIN_DELAY_MS=1500
MAX_DELAY_MS=4500
START_URL=https://www.nasdaq.com
```

## Usage

### Run the Crawler
Standard mode (uses settings from `.env`):
```bash
npm start
```

### Headless Mode
Run without opening a browser window:
```bash
npm run start:headless
```

### Test Mode
Run a quick crawl limited to a few pages (defined by `TEST_LIMIT`):
```bash
npm run crawl:test
```

### Build & Validate
```bash
npm run build     # Compile TypeScript
npm run lint      # Run Biome linter
npm run test      # Run Jest tests
npm run validate  # Run full check (format, lint, test, build)
```

## Output

All discovered endpoints are saved to the path specified in `OUTPUT_FILE` (default: `output/api-endpoints.json`). The file contains:

- **Endpoint Pattern**: The structural path of the API.
- **Example URL**: A working URL for reference.
- **Method**: HTTP method (defaults to GET).
- **Source**: Whether it was found via network interception or static parsing.
- **Response Sample**: A truncated JSON sample of the API response.
- **Metadata**: Timestamps and the list of pages where the endpoint was first seen.

## Project Structure

- `src/crawler.ts`: Core crawling logic and network interception.
- `src/urlPattern.ts`: Logic for identifying and collapsing API paths into patterns.
- `src/staticParser.ts`: Extracts potential API URLs from page content and JS files.
- `src/storage.ts`: Handles reading/writing the `api-endpoints.json` registry.
- `src/state.ts`: Manages persistence of the crawl queue and visited pages.
- `src/humanEmulation.ts`: Random delays and interaction timing.

## License

ISC
