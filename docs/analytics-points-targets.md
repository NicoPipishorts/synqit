# Analytics Points and Targets

This is the initial analytics taxonomy for Synqit. We only ingest events now (no dashboard yet).

## Targets

- `navigation`
- `auth`
- `providers`
- `events`
- `admin`
- `engagement`

## Current Event Points

### Navigation

- `app_page_view`

### Auth

- `auth_login_submit`
- `auth_login_success`
- `auth_login_failed`
- `auth_register_submit`
- `auth_register_success`
- `auth_register_failed`
- `auth_forgot_password_submit`
- `auth_forgot_password_success`
- `auth_forgot_password_failed`
- `auth_reset_password_submit`
- `auth_reset_password_success`
- `auth_reset_password_failed`

### Providers

- `providers_snapshot_loaded`
- `provider_connect_started`
- `provider_connect_succeeded`
- `provider_connect_failed`
- `provider_disconnect_succeeded`
- `provider_disconnect_failed`

### Events

- `event_create_step_changed`
- `event_create_provider_selected`
- `event_create_submitted`
- `event_create_succeeded`
- `event_create_failed`

## Storage

Events are persisted in PostgreSQL table `analytics_events` via API endpoint:

- `POST /v1/analytics/events`

Each row stores:

- optional `user_id` (if authenticated)
- `session_id`
- `event_name`
- `target`
- `page_path`
- optional `locale`
- `source` (`web`)
- optional `referrer`
- JSON `properties`
- `created_at`
