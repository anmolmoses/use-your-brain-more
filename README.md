# Site Reminder Popup (Chrome Extension)

Show a customizable reminder before visiting configured sites, with a per-site message and a global cooldown timer. All data is stored locally using `chrome.storage.local`.

## Features

- Per-site rules: pattern + message, enable/disable
- Flexible matching: full URLs, domains (e.g. `example.com`, `*.example.com`), or regex (`/.../`)
- Cooldown: don’t show again within N seconds for the same rule
- Accessible, blocking overlay with Continue / Leave Site options
- Settings page to manage everything

## Install (Load Unpacked)

1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode" (top-right)
3. Click "Load unpacked" and select this folder
4. Click "Details" → "Extension options" to configure

## How It Works

- The content script runs on all pages (`document_start`) and checks the current URL against your configured patterns.
- If a rule matches and is outside the cooldown window, a blocking overlay shows the configured message.
- Clicking Continue dismisses the overlay; Leave Site goes back or navigates to `about:blank`.
- Cooldown is tracked per rule (keyed by its pattern).

## Storage Schema

```json
{
  "entries": [
    { "pattern": "twitter.com", "message": "What’s your intention here?", "enabled": true }
  ],
  "cooldownSeconds": 0,
  "lastShown": { "pattern:twitter.com": 1710000000000 }
}
```

## Notes

- Patterns can be:
  - Domain or subdomain wildcard: `example.com`, `*.example.com`
  - Full/partial URL: `https://example.com/path`, `example.com/path`
  - Regex: `/^https?:\\/\\/.*example\\.com\\/danger/`
- Set cooldown to `0` to show every time.

