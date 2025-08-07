# BALL.MONSTER

BALL.MONSTER is a Pokémon type effectiveness calculator with support for all generations. Quickly gather type matchup info.

The site is here → [https://ball.monster](https://ball.monster)

## Features
- Three generation groups: Gen 1, Gen 2-5, Gen 6+
- **ATK** calculations by move type
- **DEF** calculations by single/dual Pokémon type
- Fuzzy search for moves and Pokémon
- Additional settings for edge-cases in type effectivity

## Roadmap
- **Team Mode** - type coverage across multiple Pokémon
- **URL Parameters** - quick sharing and bookmarking
- Fuzzy search improvements

## Privacy
This project uses **[GoAccess](https://goaccess.io/)** for privacy-respecting, cookie-free analytics. **No personally identifiable information (PII)** is collected, stored, or shared.

Instead of asking for your trust, here is what you should know:
- **No cookies** are used for tracking.
- **No IP addresses** or **user agents** are stored. Instead, a daily hash is generated from IP + UA using a rotating salt. so any data is only linked within the same day. *Note: this is technically ***pseudonymization*** rather than full ***anonymization***.
- **Referrers are sanitized**:
  - Only the scheme and host are kept (e.g., `https://example.com`).
  - URL paths and query parameters are discarded.
  - Self-referrals (like from `ball.monster`) are excluded from analytics.
- All analytics data is stored locally on the server. No third-party services are involved.

The [dashboard](https://dash.ball.monster) is public and read-only for transparency.

## Local Development
Clone the repo and install `npm` before running the dev build.
```code
npm install
npm serve
```