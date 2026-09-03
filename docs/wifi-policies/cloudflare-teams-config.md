# Cloudflare for Teams / Gateway — Campus DNS Policy Template

Academic template. Apply via **Cloudflare Zero Trust → Gateway → Firewall Policies → DNS**.

## Prerequisites

- Cloudflare Zero Trust account bound to the college's `edu` domain.
- Campus WiFi controller forwarding DNS to Cloudflare Gateway locations `172.64.36.1` / `172.64.36.2` (or via WARP client on managed devices).
- A **Team** named `SendWiseCampus`.

## Policy list (evaluated top-to-bottom)

| # | Action | Selector | Value | Reason |
|---|--------|----------|-------|--------|
| 1 | Allow  | Domain   | `counselling.example.edu`, `wellbeing.example.edu` | Never block support paths. |
| 2 | Block  | Category | Security → Command & Control, Malware, Phishing | Baseline security. |
| 3 | Block  | Category | Content → Adult Themes, Gambling, Weapons | Campus AUP. |
| 4 | Block  | Category | Content → Hate & Discrimination, Violence | Wellbeing scope. |
| 5 | Block  | Domain list | `sendwise-campus-denylist` | Custom cyberbullying/doxxing list. |
| 6 | Isolate | Category | Anonymizer, Proxy | Prevent bypass without full block. |
| 7 | Allow  | Default  | *                                    | Everything else. |

## Custom domain list — `sendwise-campus-denylist`

Create under **Gateway → Lists → Create manual list → Type: Domain**:

```
kiwifarms.net
lolcow.farm
example-campus-gossip.invalid
example-doxxer.invalid
example-revenge-host.invalid
```

(Mirror of `pihole-blocklist.txt`; keep the two in sync via CI.)

## Example policy JSON (Cloudflare API)

`POST /accounts/{account_id}/gateway/rules`:

```json
{
  "name": "SendWiseCampus - block harassment domains",
  "description": "Blocks cyberbullying and doxxing hosts per wellbeing policy",
  "precedence": 5000,
  "enabled": true,
  "action": "block",
  "filters": ["dns"],
  "traffic": "any(dns.domains[*] in $sendwise-campus-denylist)",
  "identity": "any(identity.groups.name[*] in {\"Students\"})",
  "rule_settings": {
    "block_page_enabled": true,
    "block_reason": "Blocked under SendWiseCampus wellbeing policy. Contact the student ombudsman if this is in error."
  }
}
```

## Logging & privacy

- Enable **DNS query logs** at the **team** level (aggregate).
- **Disable** per-user DNS logs on the `Students` identity group. Individual query logs are outside SendWiseCampus scope.
- Retention: 30 days, then Cloudflare-side purge.

## Change control

- Any addition to `sendwise-campus-denylist` requires wellbeing lead + student ombudsman co-approval (see `docs/OMBUDSMAN_CHARTER.md`).
- Quarterly review of blocked-category hit rates; unblock categories with <5 hits/month unless justified.
