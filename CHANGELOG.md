# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-05-21

### Docs

- Add comprehensive project documentation in `AGENTS.md` covering overview, commands, architecture, and gotchas.

### Refactor

- Extract delay constants and DOM utilities in `src/content.js`.

## [1.0.1] - 2026-05-19

### Changed

- Bumped version to 1.0.1 in `manifest.json` and `package.json`.

### Docs

- Updated `README.md` with a redesigned UI, clarified usage instructions, and improved button styling.

### CI

- Updated release workflow to use `softprops/action-gh-release@v3`.
- Enabled automatic release notes generation.
- Removed the separate artifact upload step (zip is now generated directly for release).

## [1.0.0] - 2024-05-18

### Added

- Initial release of Twitter Cleaner Chrome extension.
- Features: Delete tweets, delete replies, unlike all likes, remove reposts, live stats, stop button.
- Support for one‑click cleanup with progress display.
