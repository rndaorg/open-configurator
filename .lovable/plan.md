# Email Campaign System (SendGrid)

Build a full email marketing + transactional system on top of the existing `sendgrid-email` edge function. The user explicitly requested SendGrid, so all sends go through SendGrid (demo-mode fallback when `SENDGRID_API_KEY` is missing, per project rule).

## 1. Database (migration)

New admin-managed tables (RLS via `has_role(auth.uid(), 'admin')`):

- **`email_templates`** — `slug` (unique), `name`, `subject`, `html_body`, `text_body`, `variables` (jsonb list of supported tokens), `category` (transactional / promotional / drip / cart_recovery), `is_active`, timestamps. Admin CRUD; authenticated read for active templates.
- **`email_campaigns`** — `name`, `template_id`, `type` (newsletter / drip / cart_recovery / one_off), `status` (draft / scheduled / sending / sent / paused), `audience_filter` (jsonb: all_users, segment by last_order, has_cart, custom user_ids), `scheduled_at`, `sent_at`, `stats` (jsonb: sent/opened/clicked/failed). Admin only.
- **`email_campaign_recipients`** — `campaign_id`, `user_id`, `email`, `status` (pending/sent/failed/skipped), `sent_at`, `error`, `message_id`. Admin only.
- **`drip_campaigns`** — `name`, `trigger_event` (signup / first_order / cart_abandoned / inactive_30d), `is_active`. Admin only.
- **`drip_campaign_steps`** — `drip_campaign_id`, `step_order`, `delay_hours`, `template_id`, `condition` (jsonb optional). Admin only.
- **`drip_enrollments`** — `user_id`, `drip_campaign_id`, `current_step`, `next_send_at`, `status` (active/completed/cancelled), `enrolled_at`.
- **`email_subscriptions`** — `user_id` (unique), `email`, `newsletter` (bool), `promotional` (bool), `transactional` (bool, always true), `unsubscribe_token`, `unsubscribed_at`. User can read/update own; admin all.
- **`email_send_log`** — `template_slug`, `recipient_email`, `campaign_id` (nullable), `category`, `status`, `provider_message_id`, `error`, `sent_at`. Admin read.
- **`abandoned_carts`** — `user_id`, `email`, `cart_data` (jsonb), `total_amount`, `recovery_status` (pending/email_1_sent/email_2_sent/recovered/expired), `last_email_sent_at`, `recovered_at`, `created_at`.

Seed default templates: `order_confirmation`, `order_shipped`, `cart_recovery_1` (24h), `cart_recovery_2` (72h), `welcome`, `newsletter_default`.

## 2. Edge Functions

All accept Zod-validated input, CORS headers, admin-gated where applicable.

- **`email-send`** — single send via SendGrid. Loads template by slug, renders `{{token}}` substitutions from `templateData`, logs to `email_send_log`. Used by app code (order confirmation, etc.). Skips if recipient has `email_subscriptions.{category} = false` (except transactional).
- **`email-campaign-dispatch`** — admin-only. Given `campaign_id`, resolves audience from `audience_filter`, inserts `email_campaign_recipients`, sends in batches of 50 with delay, updates campaign stats.
- **`email-drip-processor`** — scheduled (pg_cron every 5 min). Scans `drip_enrollments` where `next_send_at <= now() and status='active'`, sends current step, advances to next step or marks completed.
- **`email-cart-recovery`** — scheduled (pg_cron hourly). Scans `abandoned_carts`: send `cart_recovery_1` after 24h pending, `cart_recovery_2` after 72h, expire after 7d.
- **`email-unsubscribe`** — public GET with `token` query param; flips `email_subscriptions.unsubscribed_at` + clears `newsletter`/`promotional`. Returns simple branded HTML page.
- Extend existing **`sendgrid-email`** as the low-level transport used by `email-send` (keep current admin-only direct sends for ad-hoc admin emails).

pg_cron jobs scheduled via `supabase--read_query` insert (per project rule for cron with user-specific URLs).

## 3. Admin UI (`/admin/email/*`)

New nav entry "Email" with sub-routes (single page with tabs to keep admin nav clean):

- **Templates** (`/admin/email/templates`) — table list, create/edit drawer with Monaco-style textarea for HTML + plain text, variable picker chips, live preview pane with sample data, send-test-email button.
- **Campaigns** (`/admin/email/campaigns`) — list with status badges, create wizard (pick template → audience filter → schedule now/later), per-campaign detail showing recipient table + stats (sent/failed counts, open-rate placeholder).
- **Drip Campaigns** (`/admin/email/drip`) — manage flows (trigger → ordered steps with delay + template), toggle active, view enrollment counts.
- **Abandoned Carts** (`/admin/email/abandoned`) — table of carts in recovery, manual "Send recovery now" action.
- **Subscribers** (`/admin/email/subscribers`) — list with subscription toggles, search by email, CSV export.
- **Send Log** (`/admin/email/logs`) — recent sends with filters (status, template, date), error inspection.

Register routes in `App.tsx` and `AdminLayout.tsx` (icon: `Mail`).

## 4. Frontend integration

- **Checkout success** → call `email-send` with `order_confirmation` template + order data (replaces direct sendgrid invocation).
- **Order status change (admin)** → existing path continues to use `sendgrid-email`; optionally route through `email-send` for logging.
- **Auth signup** → enroll user in `welcome` drip and create default `email_subscriptions` row (all enabled).
- **Cart abandonment tracking** → `CartContext` upserts `abandoned_carts` row whenever cart has items and user is identified (email known via auth or checkout email). Clears on order completion.
- **Profile / Customer Portal** → new "Email Preferences" section using `email_subscriptions` (toggles for newsletter, promotional).

## 5. i18n

New keys under `email.*` (admin labels, template categories, subscriber UI) in all 5 locales.

## Technical notes

- All template rendering uses simple `{{var}}` regex substitution server-side (no client logic).
- Unsubscribe link appended automatically to promotional + newsletter sends, omitted for transactional.
- Demo mode: if no `SENDGRID_API_KEY`, all sends log + return success without hitting SendGrid (existing pattern).
- Memory: add `mem://features/email-campaigns` summarizing architecture.
- Backward compatible: existing `sendgrid-email` function remains for direct admin use.

Approve to proceed with the migration first, then code + edge functions.
