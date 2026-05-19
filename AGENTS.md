# AGENTS.md

## Project Overview

This is a Chrome extension for deleting tweets, replies, likes, and reposts on X/Twitter. It uses a content script to interact with Twitter's UI and a popup UI to control actions. The extension is built as a modern Chrome Manifest V3 extension with Bun as the build tool.

## Essential Commands

- `bun run build` — Builds the extension into `dist/` by copying `src/` verbatim
- `bun run lint` — Runs ESLint across the codebase
- `bun run lint:fix` — Auto-fixes ESLint issues
- `bun run format` — Reformats code with Prettier
- `bun run format:check` — Validates formatting (run by pre-commit hook)
- `bun install` — Installs dependencies (uses Bun package manager)
- `bun run link` — Links the `dist/` folder to `~/.xoxo/twitter-cleaner` for easy local testing

## Build & Deployment

- **Build process**: `scripts/build.mjs` copies the entire `src/` directory to `dist/` with no transpilation or bundling. This is intentional — the extension runs as-is in Chrome.
- **CI/CD**: GitHub Actions workflow `release.yml` builds the extension and creates a ZIP release upon tag push (`v*`).
- **Distribution**: Users install by unzipping `twitter-cleaner.zip` and loading `dist/` as an unpacked extension in Chrome.

## Code Architecture

### Core Files

- `manifest.json` — Defines extension permissions, content scripts, and background service worker
- `background.js` — Minimal service worker; only logs installation
- `content.js` — The heart of the extension: detects and deletes tweets/replies/likes via DOM manipulation
- `popup.html` + `popup.js` — UI for user interaction and communication with content script

### Control Flow

1. User clicks popup button → `popup.js` sends message to content script
2. Content script starts deletion loop via `startDeletion()`, `startUnliking()`, etc.
3. Deletion loops recursively scan the page for UI elements ("More" buttons, like buttons, etc.)
4. Each action uses `chrome.storage.local` to persist target username across sessions
5. Popup polls content script every 500ms for live stats via `getStats()`
6. All actions are cancellable via `stopAll()` message

## Key Patterns & Conventions

- **DOM Detection**: Uses `data-testid` attributes and CSS selectors like `[aria-label="More"]` to locate UI elements
- **Recursive Async Loops**: Uses `await process()` inside `async` functions instead of `setInterval` for precise control and cancellation
- **Status Flags**: Uses boolean flags (`deletionInterval`, `actionInterval`) instead of interval IDs to signal active state
- **Static Copying**: No bundling or transpilation — source files are copied directly into `dist/` to preserve browser compatibility
- **No External Dependencies**: All code is self-contained; no npm packages in runtime, only dev dependencies

## Gotchas & Non-Obvious Details

1. **Username Detection**: The extension auto-discovers the user’s handle from the profile button (`[data-testid="AppTabBar_Profile_Link"]`) and saves it to `chrome.storage.local` — if this fails, actions won’t target the right account
2. **Page Navigation**: `popup.js` navigates to `/:username/likes` or `/:username/with_replies` before triggering actions — agents must ensure the correct page is loaded
3. **Timing is Critical**: All `await delay(ms)` calls are required due to Twitter’s dynamic rendering; reducing them causes UI detection failures
4. **DOM Structure Fragility**: Twitter frequently changes selectors and attributes — extension may break with site updates; expect maintenance
5. **No Local Storage for State**: Stats and deleted items are preserved only in memory during an active session — no persistence
6. **Cross-Tab Safety**: The extension works only on active tabs — no tab switching support
7. **Pre-commit Hook**: Only runs `format:check` — no linting or security checks in pre-commit
8. **No Type Safety**: No TypeScript — all JS is untyped, relying on JSDoc annotations
9. **Error Handling**: Most DOM operations wrap `try/catch`; silence is intentional, but errors appear in DevTools console

## Testing & Debugging

- Load unpacked `dist/` in `chrome://extensions/`
- Open DevTools on Twitter.com → Inspect content script in the “Content Scripts” tab
- Use `chrome.runtime.onMessage` listeners to test popup–content script communication
- Toggle `console.log` in `content.js` to trace detection and actions

## Dev Workflow Summary

1. `bun install`
2. Modify code in `src/`
3. `bun run build`
4. Reload extension in Chrome → click icon → test
5. `bun run format` → then commit

Note: `bun run link` is optional but useful for local development workflows.
