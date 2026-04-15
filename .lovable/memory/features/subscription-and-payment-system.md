---
name: Subscription & Payment System
description: Free/Pro/Enterprise tiers with Stripe+Paddle toggle via payment_provider_config table
type: feature
---
- Three tiers: Free (0), Pro ($29/mo), Enterprise ($99/mo) with yearly discounts
- payment_provider_config table lets admins toggle between Stripe and Paddle
- Auto-assigns Free tier on user registration via trigger
- Edge functions: subscription-checkout (creates checkout session), subscription-manage (cancel/resume)
- Demo mode: falls back to direct DB update when API keys missing
- Feature gating: useSubscription hook provides canAccess() and isWithinLimit()
- Pricing page at /pricing, subscription tab in /profile
