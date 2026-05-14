# Twitter Auto Cleaner — Chrome Extension

Automatically delete tweets, unlikes, unreposts, and delete replies on X/Twitter.

## Directory Structure

```
twitter-cleaner/
├── public/
│   ├── icons/             # Extension icons
│   ├── src/
│   │   ├── background.js  # Service worker
│   │   ├── content.js     # Injected into X/Twitter pages
│   │   ├── popup.html     # Popup UI
│   │   └── popup.js       # Popup logic
│   └── manifest.json      # Extension manifest (MV3)
├── scripts/
│   └── build.mjs          # Build script → dist/
├── dist/                  # Build output
└── package.json
```

## Development

The extension loads directly from source — no bundler needed.

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select this directory
4. The extension is now active on X/Twitter

## Build

Copies source files to `dist/` for a clean production copy:

```bash
node scripts/build.mjs
```

Then load `dist/` in Chrome instead of the root.

## Scripts

| Command                  | Description                |
| ------------------------ | -------------------------- |
| `node scripts/build.mjs` | Build extension to `dist/` |
| `format`                 | Format code with Prettier  |
| `lint`                   | Lint with ESLint           |
| `lint:fix`               | Auto-fix ESLint issues     |

## Features

- **Delete Tweets** — Deletes visible tweets from your profile
- **Delete Replies** — Deletes your replies specifically
- **Unlike Likes** — Unlikes all liked posts (navigates to /likes)
- **Remove Reposts** — Removes reposts
- **Backup CSV** — Downloads deleted tweets as a CSV file
- **Live Stats** — Real-time progress, counters, and elapsed time
