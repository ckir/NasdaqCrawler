# Nasdaq API Crawler

An automated crawler designed to discover, map, and document the internal API endpoints used by `nasdaq.com`. It navigates the site, intercepts network requests, and performs static analysis on JavaScript files to build a comprehensive registry of API patterns and response samples.

## Key Features

- **Automated Discovery**: Recursively crawls `nasdaq.com` to find pages that trigger API calls.
- **API Pattern Mapping**: Automatically identifies and groups similar API endpoints (e.g., collapsing `/api/quote/AAPL/info` and `/api/quote/MSFT/info` into `/api/quote/{var}/info`).
- **Network Interception**: Captures real-time traffic to identify active endpoints and save representative response JSON samples.
- **Static Analysis**: Parses JavaScript bundles on the fly to find static references to API URLs.
- **Seed File**: Ships with a pre-populated `output/api-endpoints-default.json` containing manually curated endpoints (with live response samples and source page references). Used automatically on a fresh run when no output file exists.
- **File Link Discovery**: Automatically identifies and records links to downloadable files (e.g., CSV, XLSX) hosted on the target domain.
- **Human Emulation**: Includes random delays and browser-like headers to minimize automated detection.
- **State Persistence**: Saves crawl state (visited pages, queue) to `crawler-state.json`, allowing you to resume interrupted crawls.
- **Blacklist & Throttling**: Intelligent path blacklisting (ignoring news/corporate pages) and structural throttling (limiting visits to similar page patterns like individual stock pages).
- **Exit Codes**: Exits `0` on normal completion or user-initiated stop (SIGINT/SIGTERM); exits `1` on page load failure or any other unhandled error.

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
FILE_EXTENSIONS=csv,xlsx
MIN_DELAY_MS=1500
MAX_DELAY_MS=4500
START_URL=https://www.nasdaq.com
```

The seed file is always read from the same directory as `OUTPUT_FILE`, named `api-endpoints-default.json`. It is only used when `OUTPUT_FILE` does not yet exist.

## Usage

### Run the Crawler
Standard mode (uses settings from `.env`):
```bash
pnpm start
```

### Headless Mode
Run without opening a browser window:
```bash
pnpm run start:headless
```

### Test Mode
Run a quick crawl limited to a few pages (defined by `TEST_LIMIT`):
```bash
pnpm run crawl:test
```

### Build & Validate
```bash
pnpm run build     # Compile TypeScript
pnpm run lint      # Run Biome linter
pnpm test          # Run Jest tests
pnpm run validate  # Run full check (format, lint, test, build)
```

## Output

All discovered endpoints are saved to the path specified in `OUTPUT_FILE` (default: `output/api-endpoints.json`). The file contains:

- **Endpoint Pattern**: The structural path of the API.
- **Example URL**: A working URL for reference.
- **Method**: HTTP method (defaults to GET).
- **Source**: Whether it was found via network interception (`network`), static JS parsing (`static`), or both (`both`).
- **Response Sample**: A truncated JSON sample of the API response (arrays capped at 2 items).
- **Metadata**: Timestamps and the list of pages where the endpoint was observed.

### Seed File (`output/api-endpoints-default.json`)

Contains a manually curated set of known endpoints — sourced from `ConfigAssetsBasic.mjs` — each populated with a live response sample (fetched via `apifetch.ps1`) and the Nasdaq page(s) where it appears. This file is loaded automatically on a fresh start and acts as a baseline; once the crawler writes its own `api-endpoints.json` that file takes over on subsequent runs.

To refresh the seed file samples run `apifetch.ps1` against each `exampleUrl` entry and overwrite the `responseSample` fields.

### File Links
Discovered links to files (CSV, XLSX, etc.) are saved to `file-links.json` in the same output directory. The file contains:
- **URL**: The direct link to the file.
- **Extension**: The detected file type.
- **Seen On Pages**: A list of pages (URL and title) where the link was discovered.

## Project Structure

- `src/crawler.ts`: Core crawling logic and network interception.
- `src/urlPattern.ts`: Logic for identifying and collapsing API paths into patterns.
- `src/staticParser.ts`: Extracts potential API URLs from page content and JS files.
- `src/storage.ts`: Handles reading/writing the `api-endpoints.json` registry, including seed file fallback.
- `src/state.ts`: Manages persistence of the crawl queue and visited pages.
- `src/humanEmulation.ts`: Random delays and interaction timing.
- `src/config.ts`: Typed configuration loaded from `.env`.
- `output/api-endpoints-default.json`: Manually curated seed file with known endpoints and live response samples.
- `ConfigAssetsBasic.mjs`: Source of truth for manually discovered API endpoint URLs and their Nasdaq page mappings.
- `apifetch.ps1`: Helper script to fetch a Nasdaq API endpoint with the correct browser headers (used to populate the seed file).

## License

ISC
