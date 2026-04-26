---
name: Subscription & Payment System
description: Free/Pro/Enterprise tiers with Stripe+Paddle toggle, customer portal at /billing
type: feature
---
- Three tiers: Free (0), Pro ($29/mo), Enterprise ($99/mo) with yearly discounts
- payment_provider_config table lets admins toggle between Stripe and Paddle
- Auto-assigns Free tier on user registration via trigger
- Edge functions: subscription-checkout, subscription-manage (cancel/resume)
- Demo mode: falls back to direct DB update when API keys missing
- Feature gating: useSubscription hook (canAccess, isWithinLimit)
- Pricing page at /pricing, subscription tab in /profile
- Customer Portal at /billing — invoices, payment methods, usage metrics, history, cancellation flow
- Tables: invoices, payment_methods (single-default trigger), subscription_history (auto-logged via trigger), cancellation_feedback
- Cancellation: 4-step dialog (warn → reason → feedback/NPS → confirm) in CancellationFlow.tsx
- Usage hook: useUsageMetrics tracks products/categories vs tier limits
