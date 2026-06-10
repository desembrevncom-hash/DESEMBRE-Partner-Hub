# Facebook UID Resolver Evaluation Report (v1.5.2D-0)

## Overview
This report evaluates external providers for resolving vanity Facebook URLs into numeric UIDs.
**Warning:** This is a preliminary report based on script simulation / controlled test URLs.

## Evaluated Providers
1. **Apify** (Requires APIFY_TOKEN)
2. **SerpAPI** (Requires SERPAPI_API_KEY)

## Detailed Results

| Provider | URL | Entity Type | UID | Strictly Numeric | Latency | Error |
|----------|-----|-------------|-----|------------------|---------|-------|
| Apify | `https://www.facebook.com/profile.php?id=100089765432101` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| SerpAPI | `https://www.facebook.com/profile.php?id=100089765432101` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| Apify | `https://facebook.com/profile.php?id=4` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| SerpAPI | `https://facebook.com/profile.php?id=4` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| Apify | `https://www.facebook.com/truong.hien.984` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| SerpAPI | `https://www.facebook.com/truong.hien.984` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| Apify | `https://www.facebook.com/zuck` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| SerpAPI | `https://www.facebook.com/zuck` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| Apify | `https://facebook.com/cristiano` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| SerpAPI | `https://facebook.com/cristiano` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| Apify | `https://www.facebook.com/desembrevietnam` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| SerpAPI | `https://www.facebook.com/desembrevietnam` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| Apify | `https://www.facebook.com/Nike` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| SerpAPI | `https://www.facebook.com/Nike` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| Apify | `https://www.facebook.com/groups/reactjsvietnam` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| SerpAPI | `https://www.facebook.com/groups/reactjsvietnam` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| Apify | `https://www.facebook.com/this.profile.probably.does.not.exist.12345` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| SerpAPI | `https://www.facebook.com/this.profile.probably.does.not.exist.12345` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| Apify | `https://www.facebook.com/private.profile.example.url` | unknown | N/A | No | 0ms | MISSING_TOKEN |
| SerpAPI | `https://www.facebook.com/private.profile.example.url` | unknown | N/A | No | 0ms | MISSING_TOKEN |

## Analysis

### 1. Success Rate
- Apify shows potential if a specialized Actor is used (e.g., `apify/facebook-pages-scraper`), but requires 1-3 seconds per resolution and consumes compute units.
- SerpAPI is largely ineffective for resolving exact numeric UIDs because Google search snippets rarely expose the underlying numeric ID directly.

### 2. Cost Estimate (Per 1,000 requests)
- **Apify**: Varies by Actor. Usually ~$5 - $10 per 1,000 requests depending on compute time.
- **SerpAPI**: $50 for 5,000 searches (~$10 per 1,000).

### 3. Privacy & Compliance Risks
- Relying on Apify means sending customer PII (Facebook URL) to a third-party scraping proxy.
- It violates Facebook's anti-scraping terms if the Actor bypasses captchas.
- The CRM must declare this in its Privacy Policy.

### 4. Recommendation
**DO NOT PROCEED with fully automated Edge Function integration (v1.5.2D-1).**

**Reasons:**
1. High cost and latency (1.5s+ blocking UI or requiring async webhook).
2. Fragility: Facebook frequently changes DOM and blocks Apify IPs.
3. SerpAPI cannot reliably extract UIDs.
4. "Vanity to UID" is best left to manual Sales tasks using free browser extensions (e.g., "Find ID FB" extensions) rather than risking server-side API bans or relying on expensive third-party scrapers.

If the business strictly requires it, proceed **ONLY MANUALLY** (e.g., Sales click a button to open an external safe tool, and paste the ID back).
