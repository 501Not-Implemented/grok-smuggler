# Changelog

## 1.4.1

- Fix buttons not appearing when navigating to Grok from the X.com feed (SPA client-side routing)
- Widen match pattern to all of x.com so the script loads before you reach Grok
- Add URL change observer to inject/remove buttons on route changes
- Add @license, @homepageURL, @supportURL to userscript metadata

## 1.4.0

- Add "Export All" button to bulk export every conversation with paginated history fetching
- Embed user-uploaded images as Base64 in exports for fully offline use
- Resolve Grok search result images (card attachments) to Google thumbnail URLs
- Clean `<grok:render>` tags from message content
- Preserve per-message timestamps from the API
- Use conversation creation date instead of export timestamp
- Built-in rate limiting to avoid API throttling

## Viewer (grok-viewer.html)

- Drag-and-drop, file picker, and folder picker to load exports
- Markdown rendering (tables, code blocks, blockquotes, lists, images)
- Dark theme matching Grok's UI
- Sidebar with search and sort (newest, oldest, A-Z, message count, last active)
- Delete conversations or individual messages with double-click confirmation
- Save edits back to the original file (Chrome/Edge) or download as new JSON
- User images render inline, search images display as thumbnail grids
- Broken images auto-hide
- Per-message timestamps with day and time
