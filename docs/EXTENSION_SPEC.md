# Extension Spec — SendWiseCampus browser extension

## Target

Chrome + Edge + any Chromium-based browser. Manifest V3.

Firefox second-tier (WebExtensions API is close but has quirks). Safari deferred.

## Architecture (mirrors SendWise Android IME, adapted to browser)

```
Web page (Instagram web, Discord web, Gmail, ...)
   ↓ content script hook (input event on <input>, <textarea>, contenteditable)
On-device classifier (TF.js / ONNX.js, model shipped with the extension)
   ↓ if risk detected
Warning overlay (Shadow DOM injection so page CSS cannot break it)
   ↓ user action: Edit / Send anyway / Cancel
Background service worker
   ↓ metadata only (category, severity, action_taken, anonymous_user_hash)
Wellbeing-team backend (aggregate ingest)
```

## Key modules

| Module | Job |
|---|---|
| `content-script.ts` | Attach to text inputs on a curated list of chat/social hosts. Debounced text capture. |
| `classifier.ts` | Wrap the TF.js or ONNX.js model. Cold-start budget: <200 ms. |
| `overlay.tsx` | Shadow-DOM React component. Warning text + Edit / Send anyway / Cancel. Follows SendWise's flow verbatim. |
| `bg-worker.ts` | Batch and POST metadata to `${BACKEND_URL}/api/violations`. |
| `settings.tsx` | Extension options page: link to college policy, model version, opt-out (only where policy allows). |
| `enrollment.ts` | On managed devices, the college's MDM injects `MANAGED_BOOKMARKS` / `EnterprisePolicy` with a college ID; extension binds telemetry to it. |

## Reuse from SendWise

- The Random Forest classifier weights — export from Python once, load in JS via a small `random-forest.js` runtime OR reuse an existing lightweight RF-in-JS library.
- Slur trigger list — identical JSON.
- Warning overlay copy — identical.
- Metadata schema — identical (`category`, `severity`, `action`, `timestamp`, `user_id_hash`, `session_id`).

## Host coverage (initial)

- instagram.com
- twitter.com / x.com
- discord.com
- snapchat.com (web-only surfaces)
- gmail.com and Google Workspace mail
- outlook.office.com
- teams.microsoft.com
- chat.google.com
- reddit.com
- mail.yahoo.com
- (add college-webmail-specific hosts)

Escape hatch: any page with a `contenteditable` element gets classified but no overlay unless matched host.

## Privacy properties (must be maintained)

- **Content stays on device.** The classifier runs in the browser. Metadata only leaves the machine.
- **User-hash is stable per browser profile**, never mapped to an identity server-side.
- **No content in telemetry.** Defence-in-depth: bg-worker refuses to POST any field named `text`, `content`, `message` (same rule as SendWise's parental-dashboard).
- **Settings page shows a real-time counter** of every metadata event sent — students see what the college sees.
- **Uninstall wipes local state** — the browser handles this by default; verify no residuals in IndexedDB.

## Managed-device features

Chrome Enterprise policies (all supported via ExtensionInstallForcelist + ExtensionSettings):

- `installation_mode: force_installed` — cannot be removed by user.
- `runtime_blocked_hosts` — none.
- `runtime_allowed_hosts` — the host coverage list above.
- `blocked_permissions` — none.

## Personal-device features (voluntary)

- Everything above, but the settings page includes an "Uninstall / disable telemetry" button that fully works.
- Onboarding page explains: content never leaves your device; you can turn off telemetry and still get the nudges.

## Testing

- Playwright/Puppeteer tests against a small local test page that renders each host's input DOM.
- Golden-tests for the classifier — ensure the JS port matches the Python model within tolerance.
- Manual E2E on managed Chromebook / managed Windows / managed Android tablet.

## Distribution

- Chrome Web Store — public, unlisted or restricted-visibility while piloting.
- Edge Add-ons — mirror.
- MDM push — signed extension bypasses store install when force-installed.
