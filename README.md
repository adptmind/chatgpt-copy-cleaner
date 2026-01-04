# ChatGPT Copy Cleaner

A browser extension that automatically removes citation links, reference markers, and tracking parameters when copying text from ChatGPT.

## The Problem

When you copy text from ChatGPT, the clipboard often contains:

- Citation markers like `[1]`, `[2]`
- Reference links like `([MDN Web Docs][1])`
- Reference definitions: `[1]: https://example.com "Title"`
- Tracking parameters: `?utm_source=chatgpt.com`
- Source badges: `MDN Web Docs+1`

This clutters your pastes and wastes context when feeding text back into other tools.

## The Solution

This extension intercepts copy actions and automatically cleans the text before it reaches your clipboard.

**Before:**
```
The API uses REST principles ([MDN Docs][1]).

[1]: https://developer.mozilla.org?utm_source=chatgpt.com "MDN"
```

**After:**
```
The API uses REST principles.
```

## Features

- **Aggressive cleaning**: Removes ALL links, URLs, citations, and reference markers
- **Works with both copy methods:**
  - Ctrl/Cmd+C (keyboard selection)
  - ChatGPT's copy button (clipboard API hook)
- **Cross-browser support**: Firefox and Chromium-based browsers
- **Toast notifications**: Visual feedback when cleaning is active
- **No tracking**: No analytics, no data collection

## Installation

### Chrome / Edge / Brave

1. Download or clone this repository
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the extension folder

### Firefox

1. Download or clone this repository
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `manifest.json`

## Usage

1. Go to [chatgpt.com](https://chatgpt.com)
2. Copy text from an assistant message (Ctrl+C or copy button)
3. Paste anywhere - citation noise is automatically removed
4. A green toast notification confirms the hook is active

## How It Works

The extension uses two interception strategies:

1. **Selection copy (Ctrl+C)** - Listens for `copy` events and cleans text via `clipboardData.setData()`

2. **Copy button** - Patches `navigator.clipboard.writeText()` and `navigator.clipboard.write()` in the page context:
   - **Firefox**: Uses `wrappedJSObject` + `exportFunction` (bypasses CSP)
   - **Chromium**: Injects `page_final.js` into the page world

## Files

```
├── manifest.json       # Extension manifest (MV3)
├── content.js          # Content script (selection copy + hook injection)
├── page_final.js       # Page-world script (clipboard API patches)
├── popup.html/css/js   # Settings popup UI
├── icons/              # Extension icons
└── generate-icons.html # Icon generator tool
```

## Browser Support

- Chrome 88+
- Edge 88+
- Firefox 109+
- Brave, Opera, Vivaldi (Chromium-based)

## Troubleshooting

**Copy button not working?**
- Check browser console for `[ChatGPT Copy Cleaner]` messages
- If you see "hook blocked", CSP may be preventing script injection
- Selection copy (Ctrl+C) should still work as fallback

**Toast not appearing?**
- Make sure you're on chatgpt.com or chat.openai.com
- Reload the page after installing the extension

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT License - see [LICENSE](LICENSE) file for details.
