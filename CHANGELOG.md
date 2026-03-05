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
