# Loader Integration Handoff

This repository now produces integrity metadata for plugin artifacts through the canonical build pipeline.

## Scope Completed In `venera-configs`

- Plugin discovery and validation via `plugins/*/plugin.config.json`.
- Deterministic artifact generation via `npm run generate`.
- Public index embedding via `.generated/build-manifest.json#publicIndex`.
- `index.json` generated from plugin configs, not a hand-written catalog.
- Artifact integrity metadata (`sha256`, `bytes`) written into `.generated/build-manifest.json`.
- Runtime compatibility smoke coverage via `npm run test:runtime`.
- Dynamic execution audit via `npm run audit:unsafe-runtime-code`.

## Important Boundary

This repository generates metadata only. Runtime integrity enforcement is not active until the Venera app loader verifies hashes before execution.

## Cross-Repo Loader Requirements

The app loader integration must define and enforce:

1. Trusted index origin.
2. Hash verification before plugin execution.
3. Known-good fallback behavior when verification fails.
4. Integrity failure user experience (error surface and recovery path).

## Current Canonical Inputs

- `scripts/config/release-authority.json`
- `.generated/build-manifest.json`
