---
name: Wishlist and shared configurations
description: Wishlist, shareable config links with QR/social, and realtime collaborative editing
type: feature
---
# Wishlist & Sharing

## Tables
- `wishlists` — user-owned saved products/configurations
- `shared_configurations` — public-readable share links keyed by `share_token` (12-char base36). Owner-only writes; collaborative+allow_edits permits authenticated edits
- `shared_configuration_collaborators` — live presence (display_name, last_seen_at). FK column is `shared_config_id`

## Realtime
Both share tables are added to `supabase_realtime` publication with REPLICA IDENTITY FULL. `useCollaborativeShare` subscribes to a per-share channel for collaborator presence + configuration_data updates. Local edits are debounced (400ms) before broadcasting via UPDATE on `shared_configurations`.

## Routes
- `/wishlist` (protected)
- `/shared/:shareToken` — resolves token, increments view_count, mounts ProductConfigurator with `initialOptions`, `sharedConfigId`, `isCollaborative`, `allowEdits`

## Components
- `WishlistButton` — toggles save, requires auth (redirects)
- `ShareConfigurationDialog` — generates link, QR (qrcode.react), social buttons (FB/Twitter/LinkedIn/WhatsApp/Email)
- `ProductConfigurator` accepts share/collab props and renders avatars for collaborators

## Notes
- `share_token` is the secret — RLS allows public SELECT
- Avoid feedback loops in collab updates via `isRemoteUpdateRef`
