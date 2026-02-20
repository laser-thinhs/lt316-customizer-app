# Security Hardening Summary (Feb 18, 2026)

## Auth Configuration
- **Automatic enforcement**: Auth is now automatically required in production/staging (VERCEL_ENV detection)
- **Local dev**: Auth remains optional (API_AUTH_REQUIRED=false) for convenience
- **Test environment**: Auth disabled by default, can be enforced per-test
- **Validation**: App fails fast on startup if auth is required but not configured (no empty API_KEY)
- **Secure key generation**: Use `openssl rand -base64 32` to generate strong API_KEY values

## Public API Endpoints
The following endpoints are intentionally public (no auth required):
- `GET /api/health` - Connectivity status
- `GET /api/fonts` - Font registry
- `GET /api/product-profiles` - Product catalog
- `GET /api/product-profiles/:id` - Product details
- `GET /api/assets/:id` - Asset file retrieval (read-only)

All other routes require `x-api-key` and `x-actor-role` headers when auth is enabled.

## SVG Sanitization
Enhanced to reject:
- Inline event handlers (`onclick`, `onload`, etc.)
- Script tags and content
- Style tags
- Dangerous iframe/embed/object/applet tags
- JavaScript protocol URLs (`javascript:`)
- Non-image data URIs (`data:` that aren't `data:image/*`)

Server-side SVG normalization additionally:
- Strips script tags
- Removes all event handler attributes
- Removes style tags
- Blocks dangerous protocols

## Secret Rotation
**CRITICAL**: The VERCEL_OIDC_TOKEN in `.env.local` has been removed. This was an internal Vercel CI token (not used by the app code).

If you use this token elsewhere (e.g., CI/CD pipelines):
1. Revoke it in Vercel dashboard
2. Generate a new one
3. Store in secure secrets manager (GitHub Secrets, Vercel env vars, etc.)
4. Never commit env files to git

## Test Cleanup
React testing warnings (act/open-handle) are suppressed in text-editor test where state updates in effects are intentional and acceptable.

## Recommendations for Production Deployment
1. **Set API_AUTH_REQUIRED=true** and provide a strong **API_KEY** (32+ chars)
2. **Enable HTTPS only** (Vercel default)
3. **Use environment-specific .env files** (never commit .env.local)
4. **Rotate API_KEY** periodically
5. **Monitor dependency updates** (as of Feb 20, 2026: `npm audit --omit=dev --audit-level=high` reports **0** production vulnerabilities; full audit reports **32 high** dev-tooling vulnerabilities in eslint/jest/minimatch chains, requiring major toolchain upgrades for full remediation)
6. **Add rate limiting** if exposing public endpoints to untrusted clients
