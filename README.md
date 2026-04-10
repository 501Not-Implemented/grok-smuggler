# grok-smuggler for x.com

Take back your Grok conversation history. Export it, keep a local copy, and delete it from Elon's servers knowing nothing was lost.

Two tools that work together: a Tampermonkey userscript to pull your [Grok](https://x.com/i/grok) conversations as JSON (images included), and a single offline HTML file to browse, search, edit, and save them locally.

## How It Works

1. **Export** - A [Tampermonkey](https://www.tampermonkey.net/) userscript that runs on `x.com/i/grok` and exports your conversations as JSON, with embedded images
2. **View** - A single offline HTML file that renders your exports with markdown, tables, code blocks, and image grids

## Features

### Exporter (`x-grok-exporter.user.js`)

- Export a single conversation with one click from any `x.com/i/grok?conversation=` page
- Export all conversations at once with paginated history fetching
- User-uploaded images downloaded and embedded as Base64 for fully offline exports
- Grok search result images (card attachments) resolved to reliable thumbnail URLs
- Message timestamps preserved from the API
- Rate limiting built in to avoid API throttling
- `<grok:render>` tags cleaned from message content

### Viewer (`grok-viewer.html`)

- Drag-and-drop or file/folder picker to load JSON exports
- Markdown rendering via [marked.js](https://github.com/markedjs/marked): tables, code blocks with language labels, blockquotes, lists, images
- Dark theme inspired by Grok's native UI
- Sidebar with conversation list, search, and sort (newest, oldest, A-Z, most messages, last active)
- Delete conversations or individual messages with double-click confirmation
- Save directly back to the original file (Chrome/Edge) or download as a new JSON
- Image handling: user uploads render inline, Grok search images display as compact thumbnail grids, broken images auto-hide
- Timestamps on each message showing day and time
- Responsive layout

## Setup

### Exporter (Tampermonkey required)

The exporter is a userscript that needs [Tampermonkey](https://www.tampermonkey.net/) to run. Install it for your browser:

- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) - fully supported
- [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) - fully supported
- [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) - fully supported
- [Safari](https://apps.apple.com/app/tampermonkey/id1482490089) - may work, untested

Then:

1. Open the Tampermonkey dashboard and click **Create a new script**
2. Paste the contents of `x-grok-exporter.user.js` and save
3. Navigate to [x.com/i/grok](https://x.com/i/grok) and you'll see **Export as JSON** and **Export All** buttons in the bottom-right corner

You must be logged into X.com. The script uses your existing session cookies to authenticate with the Grok API.

### Viewer (no install needed)

Just open `grok-viewer.html` in any modern browser. Everything is self-contained in one file.

- **Load files:** Click "Choose Files" or drag-and-drop JSON exports onto the page
- **Load folders:** Click "Open Folder" to load all JSON files from a directory
- **Save edits:** Click "Save" to persist changes

The viewer works best in **Chrome or Edge**. These browsers support the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API), which lets you save edits directly back to the original file on disk without re-downloading. Firefox and Safari fall back to downloading a new copy.

## Export Format

Each exported conversation is a JSON object:

```json
{
  "title": "Conversation Title",
  "author": "grok",
  "date": "2026-04-03T12:00:00.000Z",
  "url": "https://x.com/i/grok?conversation=...",
  "exporter": "x-grok-exporter-1.4.0",
  "tags": [],
  "messages": [
    {
      "id": "user-1",
      "author": "user",
      "content": "Hello!",
      "timestamp": 1775242624845
    },
    {
      "id": "ai-1",
      "author": "ai",
      "content": "Hi there! How can I help?",
      "timestamp": 1775242630000
    }
  ]
}
```

The **Export All** button produces a JSON array of these objects.

## Browser Compatibility

|  | Chrome / Edge | Firefox | Safari |
|---|---|---|---|
| **Exporter** | Tampermonkey | Tampermonkey | Tampermonkey (untested) |
| **Viewer** | Full support | Full support | Full support |
| **Save to original file** | Direct write-back | Download only | Download only |
| **Drag-and-drop save-back** | Direct write-back | Download only | Download only |

Export from whichever browser you use Grok in. View in Chrome/Edge for the best save experience.

## License

MIT
