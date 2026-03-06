# [1.4.0](https://github.com/stefanhoth/crusty-proxy/compare/v1.3.1...v1.4.0) (2026-03-06)


### Features

* **health:** add ?check flag for live upstream reachability probes ([336632f](https://github.com/stefanhoth/crusty-proxy/commit/336632f290b6199324503a0b782f2a07fcfc9531))

## [1.3.1](https://github.com/stefanhoth/crusty-proxy/compare/v1.3.0...v1.3.1) (2026-03-06)


### Bug Fixes

* **logging:** align startup log with /health — show enabled state, include upstreams ([fce2bce](https://github.com/stefanhoth/crusty-proxy/commit/fce2bce24181c6b9d61bb6b8d8673ca5f7d08986))

# [1.3.0](https://github.com/stefanhoth/crusty-proxy/compare/v1.2.0...v1.3.0) (2026-03-06)


### Features

* **calendar:** replace Google Calendar OAuth2 with CalDAV/ICS via tsdav ([6a0e9c1](https://github.com/stefanhoth/crusty-proxy/commit/6a0e9c1c03d5c2ed5fcccd5870a26abaa2713cb9))

# [1.2.0](https://github.com/stefanhoth/crusty-proxy/compare/v1.1.6...v1.2.0) (2026-03-06)


### Features

* **gws:** add Google Workspace CLI as stdio upstream for Calendar and Gmail ([b1601cd](https://github.com/stefanhoth/crusty-proxy/commit/b1601cd6648019a0cb11caa4a2e638ab0e2f46ca))

## [1.1.6](https://github.com/stefanhoth/crusty-proxy/compare/v1.1.5...v1.1.6) (2026-03-06)


### Bug Fixes

* increase JSON body limit to 20mb for base64 image payloads ([0bc11cb](https://github.com/stefanhoth/crusty-proxy/commit/0bc11cbae065859d3a5877968e94fe21622bab01))

## [1.1.5](https://github.com/stefanhoth/crusty-proxy/compare/v1.1.4...v1.1.5) (2026-03-06)


### Bug Fixes

* **gemini:** use camelCase inlineData/mimeType matching the API response format ([2351051](https://github.com/stefanhoth/crusty-proxy/commit/235105150ab032baa8611898e42a237536a8dceb))

## [1.1.4](https://github.com/stefanhoth/crusty-proxy/compare/v1.1.3...v1.1.4) (2026-03-06)


### Bug Fixes

* **gemini:** log finishReason and parts when generate_image returns no images ([2b05a63](https://github.com/stefanhoth/crusty-proxy/commit/2b05a63cd14b3aa1295204183f39cfc29fc32f36))

## [1.1.3](https://github.com/stefanhoth/crusty-proxy/compare/v1.1.2...v1.1.3) (2026-03-06)


### Bug Fixes

* **gemini:** align generate_image signature to gemini-2.5-flash-image API ([3a27893](https://github.com/stefanhoth/crusty-proxy/commit/3a27893d959a918d28b11353b363a19e2435e23c))

## [1.1.2](https://github.com/stefanhoth/crusty-proxy/compare/v1.1.1...v1.1.2) (2026-03-06)


### Bug Fixes

* **gemini:** replace Imagen 3 predict endpoint with gemini-2.5-flash-image generateContent ([b347baf](https://github.com/stefanhoth/crusty-proxy/commit/b347baf56bb186e8a7208356f56fc4d046abbf4c))

## [1.1.1](https://github.com/stefanhoth/crusty-proxy/compare/v1.1.0...v1.1.1) (2026-03-06)


### Bug Fixes

* **gemini:** upgrade edit_image model from gemini-2.0-flash-exp to gemini-2.5-flash-image ([5b8c8e2](https://github.com/stefanhoth/crusty-proxy/commit/5b8c8e2c85f9e47dfe377164613d90ab2adeab6c))

# [1.1.0](https://github.com/stefanhoth/crusty-proxy/compare/v1.0.5...v1.1.0) (2026-03-05)


### Features

* add Streamable HTTP transport at /mcp for mcporter compatibility ([6d40999](https://github.com/stefanhoth/crusty-proxy/commit/6d40999aa13e2824d050b5a8e5ce5bc31fabb772))
* **logging:** add timestamps, structured startup info, and tool call audit ([51c4dab](https://github.com/stefanhoth/crusty-proxy/commit/51c4dabf46c9d5e47ca14d0e61d64ab37b9bcf4d))

## [1.0.5](https://github.com/stefanhoth/crusty-proxy/compare/v1.0.4...v1.0.5) (2026-03-05)


### Bug Fixes

* **ci:** checkout release tag in docker job to get updated package.json ([659bccf](https://github.com/stefanhoth/crusty-proxy/commit/659bccf67653ee8033b7cd3ad6ebc365a3819370))

## [1.0.4](https://github.com/stefanhoth/crusty-proxy/compare/v1.0.3...v1.0.4) (2026-03-05)


### Bug Fixes

* read version from package.json instead of hardcoding it ([fb6ee6b](https://github.com/stefanhoth/crusty-proxy/commit/fb6ee6b4f75588de62d2890cd1390cc3a02dfbdc))

## [1.0.3](https://github.com/stefanhoth/crusty-proxy/compare/v1.0.2...v1.0.3) (2026-03-05)


### Bug Fixes

* **health:** reflect allowlist enabled state in /health response ([e01f721](https://github.com/stefanhoth/crusty-proxy/commit/e01f7214180c997cca42ccba9687e8e6031a4d98))

## [1.0.2](https://github.com/stefanhoth/crusty-proxy/compare/v1.0.1...v1.0.2) (2026-03-05)


### Bug Fixes

* rename container user to crusty, replace git clone with curl ([354c107](https://github.com/stefanhoth/crusty-proxy/commit/354c107aa11ce8ac2e15d440049672fccda4a378))

## [1.0.1](https://github.com/stefanhoth/crusty-proxy/compare/v1.0.0...v1.0.1) (2026-03-05)


### Bug Fixes

* **deps:** update dependency express to v5 ([#6](https://github.com/stefanhoth/crusty-proxy/issues/6)) ([0f760da](https://github.com/stefanhoth/crusty-proxy/commit/0f760da5b5eb0f1890487c73162a3bf5502e3181))

# 1.0.0 (2026-03-05)


### Bug Fixes

* **deps:** upgrade nodemailer to 7.x to address CVE DoS and domain spoofing ([d662bb8](https://github.com/stefanhoth/crusty-proxy/commit/d662bb88ef2a4e8a2ba548de5d99cc4116e0257f))
* **docker:** bump Go builder to 1.25 — goplaces v0.3.0 requires go >= 1.25.5 ([9d5faa0](https://github.com/stefanhoth/crusty-proxy/commit/9d5faa0d7a71cd83bba49aea36c2368acd98c01a))


### Features

* **calendar:** add Google Calendar service via OAuth2 refresh token ([e721c61](https://github.com/stefanhoth/crusty-proxy/commit/e721c619ae28be64d464270ac582e6fc7b8aa12f))
* **config:** add Zod schemas for keys and allowlist with validation ([bc2683b](https://github.com/stefanhoth/crusty-proxy/commit/bc2683ba85da6ae5df7b120eb09fef1ee0dfce74))
* **docker:** add docker-compose with network isolation ([4472c75](https://github.com/stefanhoth/crusty-proxy/commit/4472c752f5287720d704472ae6db26c0e77d34be))
* **docker:** add hardened multi-stage Dockerfile ([478457b](https://github.com/stefanhoth/crusty-proxy/commit/478457b59bc58ef167456ff5b2c41d3320b8097f))
* **email:** add IMAP read and SMTP send via imapflow and nodemailer ([64da6e1](https://github.com/stefanhoth/crusty-proxy/commit/64da6e10ea28190c40e90c40130b1cc8e553af49))
* **gemini:** add image generation (Imagen 3) and editing (Gemini 2.0 Flash) ([58b7426](https://github.com/stefanhoth/crusty-proxy/commit/58b74267e9636dcb50b25b097099683e5292ff59))
* **places:** add Google Places via goplaces CLI subprocess ([4ed4fe6](https://github.com/stefanhoth/crusty-proxy/commit/4ed4fe65f9a2ce28e62cf7c5daed8c25b531c351))
* **proxy:** add MCP SSE server with dot-notation tools and allowlist enforcement ([c613ad1](https://github.com/stefanhoth/crusty-proxy/commit/c613ad142f78cd4674ccc8bae9517e02cf7c0851))
* **todoist:** proxy official Todoist hosted MCP (ai.todoist.net/mcp) ([f7597fb](https://github.com/stefanhoth/crusty-proxy/commit/f7597fbad8e17abdec42eb463e76436c9a604acb))
* **upstream:** add generic upstream MCP client with allowlist and tool prefixing ([eeeec89](https://github.com/stefanhoth/crusty-proxy/commit/eeeec8903931b9ef12c78ad70987da0565bf3df5))
