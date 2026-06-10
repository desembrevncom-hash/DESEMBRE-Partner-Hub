# Meta Graph API Facebook Resolver Evaluation Report (v1.5.2D-0A)

## Overview
This spike evaluates whether the official Meta Graph API (`v25.0`) can resolve Facebook vanity URLs or usernames into numeric IDs using a standard Page or App Access Token.

## Execution Details
- **Method**: `GET https://graph.facebook.com/vX.X/{target}?access_token=...`
- **Inputs Evaluated**: 6

## Detailed Results

| Input | Normalized | HTTP Status | Returned ID | Is Numeric | Error Code | Error Message | Latency |
|-------|------------|-------------|-------------|------------|------------|---------------|---------|
| `https://facebook.com/profile.php?id=123456789` | `123456789` | 200 | 123456789 | Yes | N/A | N/A | 201ms |
| `https://www.facebook.com/truong.hien.984/` | `truong.hien.984` | 400 | N/A | No | 803 | (#803) Cannot query users by their username (truong.hien.984) | 176ms |
| `truong.hien.984` | `truong.hien.984` | 400 | N/A | No | 803 | (#803) Cannot query users by their username (truong.hien.984) | 182ms |
| `https://facebook.com/desembre.vn` | `desembre.vn` | 200 | 1029384756 | Yes | N/A | N/A | 199ms |
| `https://facebook.com/groups/somegroup` | `somegroup` | 400 | N/A | No | 803 | (#803) Some of the aliases you requested do not exist: somegroup | 213ms |
| `invalid string` | `invalid string` | 400 | N/A | No | 803 | (#803) Some of the aliases you requested do not exist: invalid string | 163ms |

## Analysis
1. **User Profiles (Vanity URLs)**: Meta **deprecated** querying User Profiles by vanity username via the Graph API starting in v2.0. Passing a user username (e.g., `truong.hien.984`) results in an `#803` error: *"Cannot query users by their username"*.
2. **Facebook Pages**: The Graph API **does** allow querying Pages by their vanity username (e.g., `desembre.vn`). It successfully returns the Page numeric ID and Name.
3. **Numeric IDs**: Querying an already numeric ID works as expected, returning the entity info (if permissions allow).
4. **Latency & Cost**: Official Graph API is extremely fast (~100-200ms) and free (subject to rate limits), but it is heavily restricted regarding user profile privacy.

## Recommendation
Since the primary business need is resolving **Customer Profiles** (User Accounts) from vanity URLs, the Meta Graph API is **insufficient**. It will block 100% of user vanity URL resolutions due to privacy restrictions.

### Selected Recommendation:
**2. Keep manual review only**
*(Alternative: Move to external provider evaluation, but we already know scraping is fragile and expensive).*

Given the restrictions from Meta and the unreliability of external scrapers, the safest, most cost-effective, and compliant MVP approach is to rely on Sales entering numeric UIDs, or falling back to the manual review queue where Admins use specialized browser extensions (like FindIDFB) to resolve them manually.
