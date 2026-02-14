# Translation Workflow (EN/FR)

## Current setup

- Source files:
  - `apps/web/src/locales/en/common.json`
  - `apps/web/src/locales/fr/common.json`
- Runtime i18n provider:
  - `apps/web/src/lib/i18n/index.tsx`
- Hook:
  - `apps/web/src/hooks/useI18n.ts`

## Add / edit text

1. Add the key in `en/common.json`.
2. Add the same key in `fr/common.json`.
3. Keep variable placeholders identical (example: `{{email}}`, `{{year}}`).
4. Use `t('path.to.key')` in components.

## Validate translations

Run:

```bash
yarn workspace @synqit/web i18n:check
```

The check validates:

- key parity between EN and FR
- type parity
- placeholder parity

## Future contributor dashboard path

When you want external contributors:

1. Connect a localization platform (Tolgee, Crowdin, or Lokalise).
2. Keep `en/common.json` as source-of-truth and sync generated locale JSON back to repo.
3. Add CI step to run `i18n:check` on every PR.
4. Optionally expose a read-only internal “translation status” page from these JSON files.
