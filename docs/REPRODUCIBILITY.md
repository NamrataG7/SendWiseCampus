# Reproducibility

This document is the reviewer checklist for reproducing the artefacts
published alongside the SendWise Campus paper.

## One-command bring-up

```bash
docker compose --profile review up
```

This starts a clean `postgres:16` container and a one-shot
`dashboard-migrate` container that applies every SQL file in
`supabase/migrations/` (in lexical order) plus `supabase/seed.sql` if
present. The migrator exits `0` when the chain applies cleanly. See
[`docker-compose.yml`](../docker-compose.yml) for the env vars a reviewer
may override (defaults are safe).

> **Note:** the Next.js dashboard runtime is intentionally not included
> in Compose — its Supabase-auth wiring is out of scope for a minimal
> bring-up. Reviewers wanting the UI must run it separately:
>
> ```bash
> cd campus-dashboard && npm install && npm run dev
> ```

## Migration verification

After `docker compose --profile review up` exits:

```bash
# Confirm every migration applied.
docker compose --profile review exec postgres \
  psql -U sendwise -d sendwise -c '\dt'

# Confirm the audit_log chain triggers and the drill-down tables exist.
docker compose --profile review exec postgres \
  psql -U sendwise -d sendwise -c '\d+ audit_log'
docker compose --profile review exec postgres \
  psql -U sendwise -d sendwise -c '\d+ drill_down_requests'
```

## Audit anchor

Generate an anchor against the local Compose database:

```bash
cd scripts/audit-anchor
npm install
DATABASE_URL='postgres://sendwise:sendwise@localhost:54329/sendwise' \
  CAMPUS_CODE='reviewer-local' \
  node anchor.mjs
```

Verify a published anchor JSON against a live DB:

```bash
DATABASE_URL='postgres://sendwise:sendwise@localhost:54329/sendwise' \
  node verify.mjs out/anchor-YYYYMMDD.json
# Expected: PASS, exit code 0.
```

See [`docs/AUDIT_ANCHOR.md`](AUDIT_ANCHOR.md) for the threat model.

## Transparency report

```bash
cd scripts/transparency-report
npm install
DATABASE_URL='postgres://sendwise:sendwise@localhost:54329/sendwise' \
  REPO_URL='https://github.com/<org>/SendWiseCampus' \
  node generate.mjs
# Output: scripts/transparency-report/out/transparency-YYYYMM.{html,json}
```

See [`docs/TRANSPARENCY_REPORT.md`](TRANSPARENCY_REPORT.md) for the
publication policy and the K=5 suppression rule.

## Pinned commits

The last 10 commits that pin the artefact set at the time this document
was written:

```
44f6c54 feat(privacy): k-anonymity floor on aggregate UI + local differential privacy on extension egress
d4f5410 feat(governance): cryptographic dual-control signatures (Ed25519) + ombudsman key-rotation ceremony (3-of-N)
546bc17 docs(paper): related-work survey, gap matrix, novelty claims, venue targets, IMRaD outline
c1f272c ci(supabase): also stub 'authenticated', 'anon', 'service_role' PG roles for RLS lint
8b80e16 feat(dashboard): public landing page at /, move dashboard to /dashboard
88819a1 ci(supabase): stub auth.uid/role/jwt before migrations (RLS uses Supabase-managed helpers)
534a835 fix(keyboard): resolve Kotlin compile errors after Lane 5 deletions
cf6514d fix(keyboard): restore full strings.xml from SendWise (aapt2 linking failed on 20 missing keys)
10109af feat(keyboard): fork SafeKeyboardApp as SendWiseCampusKeyboard (drop parent-visible screens, MDM-fed enrollment stub) + CI apk-build job
17806c0 ci: add GitHub Actions workflow (dashboard typecheck, MV3 extension zip, supabase migration lint)
```

Reviewers can regenerate this list with:

```bash
git log --oneline -10
```
