# Email Deliverability Checklist (Registration Emails)

To reduce spam-folder placement, configure these items before enabling live sends.

## 1) Domain authentication

Set DNS records on your sender domain (for example `mail.synqit.app`):

- `SPF`:
  - include your provider (Resend, SES, Postmark, etc.)
- `DKIM`:
  - add all DKIM CNAME/TXT records provided by your email provider
- `DMARC`:
  - start with `p=none`, then move to `quarantine` or `reject` after validation

Example DMARC starter:

```txt
v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com; adkim=s; aspf=s; pct=100
```

## 2) Use a verified sender identity

- `EMAIL_FROM` must use your verified sender/domain
- avoid free mailbox from-addresses
- keep `reply-to` valid (`EMAIL_REPLY_TO`)

## 3) Content hygiene

- keep subject/body clear and transactional
- include plain-text and HTML versions (already implemented)
- avoid spammy wording, excessive links, and URL shorteners

## 4) Warm-up and monitoring

- start with low send volume and ramp up gradually
- monitor bounce/spam complaint webhooks from provider
- suppress hard-bounce addresses from future sends

## 5) Environment settings used in this repo

Worker env:

- `EMAIL_PROVIDER=log|resend|disabled`
- `EMAIL_FROM=Synqit <no-reply@yourdomain.com>`
- `EMAIL_REPLY_TO=support@yourdomain.com`
- `RESEND_API_KEY=...` (only for `EMAIL_PROVIDER=resend`)

API env:

- `AUTH_REGISTRATION_EMAIL_ENABLED=true` to enqueue registration confirmation jobs
- `ADMIN_EMAIL_PREVIEW_KEY=<strong-random-key>` for admin preview endpoints

## 6) Verify send flow quickly (admin preview)

Trigger preview email:

```bash
curl -X POST http://127.0.0.1:3001/v1/admin/email/preview \
  -H "content-type: application/json" \
  -H "x-admin-key: <ADMIN_EMAIL_PREVIEW_KEY>" \
  -d '{"toEmail":"you@example.com","locale":"en"}'
```

Expected response:

- `202` with a `jobId`

Check queue job status:

```bash
curl http://127.0.0.1:3001/v1/admin/email/jobs/<jobId> \
  -H "x-admin-key: <ADMIN_EMAIL_PREVIEW_KEY>"
```

Expected states:

- `waiting` / `active` / `completed` / `failed`

If state is `failed`, inspect worker logs and provider dashboard for details.
