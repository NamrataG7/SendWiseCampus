# MDM Deployment Guide — SendWiseCampus Extension

Force-install the MV3 browser extension on college-owned devices via each platform's MDM. Placeholders below — replace before piloting.

- **Extension ID (placeholder):** `abcdefghijklmnopabcdefghijklmnop`
- **Update URL (placeholder):** `https://clients2.google.com/service/update2/crx` (Chrome Web Store) or `https://campus.example.edu/sendwise/updates.xml` (self-hosted)

---

## 1. Chrome Enterprise — `ExtensionInstallForcelist`

Applies to managed Chrome / Chromium on Windows, macOS, Linux, ChromeOS.

- Policy name: `ExtensionInstallForcelist`
- Format: `"<extension-id>;<update-url>"`
- Pair with `ExtensionSettings` to lock permissions.

Example JSON (Windows registry / macOS plist / policies.json):

```json
{
  "ExtensionInstallForcelist": [
    "abcdefghijklmnopabcdefghijklmnop;https://clients2.google.com/service/update2/crx"
  ],
  "ExtensionSettings": {
    "abcdefghijklmnopabcdefghijklmnop": {
      "installation_mode": "force_installed",
      "update_url": "https://clients2.google.com/service/update2/crx",
      "runtime_allowed_hosts": ["*://instagram.com", "*://x.com", "*://discord.com"],
      "blocked_permissions": []
    }
  }
}
```

- Deploy path (Windows): `HKLM\Software\Policies\Google\Chrome\ExtensionInstallForcelist`
- Deploy path (macOS): `/Library/Managed Preferences/com.google.Chrome.plist`
- Deploy path (Linux): `/etc/opt/chrome/policies/managed/sendwise.json`

---

## 2. Google Admin Console (ChromeOS + managed Chrome)

For Chromebooks and users signed into managed Chrome.

- Go to **Admin console → Devices → Chrome → Apps & extensions**.
- Select the **Users & browsers** or **Managed guest sessions** scope (org unit = student devices).
- Click **+ → Add Chrome app or extension by ID**.
- Enter extension ID `abcdefghijklmnopabcdefghijklmnop`. Select **From a custom URL** if self-hosting; paste update URL.
- Installation policy: **Force install**.
- Permissions & URL access: allow host permissions listed in `EXTENSION_SPEC.md`.
- Save. Policy propagates within ~90 minutes; users can force refresh via `chrome://policy`.

---

## 3. Microsoft Intune — Configuration Profile

For managed Windows 10/11 or macOS running Chrome/Edge.

- **Devices → Configuration profiles → Create profile**.
- Platform: **Windows 10 and later** (or macOS).
- Profile type: **Settings catalog**.
- Search: `ExtensionInstallForcelist` (Chrome) or `ExtensionInstallForcelist` under Microsoft Edge.
- Add value: `abcdefghijklmnopabcdefghijklmnop;https://edge.microsoft.com/extensionwebstorebase/v1/crx` (Edge) or the Chrome update URL.
- Optional: add `ExtensionSettings` JSON as an OMA-URI custom setting:
  - OMA-URI: `./Device/Vendor/MSFT/Policy/Config/Chrome~Policy~googlechrome~Extensions/ExtensionSettings`
  - Value: JSON blob from section 1.
- Assign to the **Student Devices** group. Monitor rollout under **Device status**.

---

## 4. Jamf — macOS Chrome / Edge Policy

For college-owned Macs.

- **Computers → Configuration Profiles → New**.
- Payload: **Application & Custom Settings → External Applications**.
- Preference Domain: `com.google.Chrome` (or `com.microsoft.Edge`).
- Upload a plist containing:

```xml
<key>ExtensionInstallForcelist</key>
<array>
  <string>abcdefghijklmnopabcdefghijklmnop;https://clients2.google.com/service/update2/crx</string>
</array>
<key>ExtensionSettings</key>
<dict>
  <key>abcdefghijklmnopabcdefghijklmnop</key>
  <dict>
    <key>installation_mode</key><string>force_installed</string>
    <key>update_url</key><string>https://clients2.google.com/service/update2/crx</string>
  </dict>
</dict>
```

- Scope: **Student Lab Macs** smart group.
- Distribution: **Install Automatically**.
- Verify in `chrome://policy` on a scoped Mac.

---

## 5. Android Enterprise — Managed Configurations

For college-owned Android tablets running managed Chrome.

- Use your EMM (Google Workspace, Intune, Jamf Pro for Android, etc.).
- Add **Chrome** as a managed app; open **App configuration / Managed configuration**.
- Set key `ExtensionInstallForcelist` to:
  - `["abcdefghijklmnopabcdefghijklmnop;https://clients2.google.com/service/update2/crx"]`
- Set key `ExtensionSettings` to the JSON blob from section 1 (as a string).
- Assign to the **Student Tablets** device group.
- For the SendWise IME (separate app), also push it via **Managed Google Play** with **Install type = Force install** and set it as default keyboard via the `DevicePolicyManager` `setPermittedInputMethods` in the DPC.

---

## Verification checklist

- `chrome://policy` shows `ExtensionInstallForcelist` with the correct ID and update URL.
- Extension icon appears; cannot be removed by the user.
- Extension options page shows the managed-device banner.
- Telemetry POSTs land in the wellbeing-team backend within ~5 minutes of a test event.
