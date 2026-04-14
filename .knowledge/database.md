# Database Tables

Defined in `supabase/migrations/` starting from `00001_initial_schema.sql`. Later migrations add incremental tables/columns.

## Core tables (00001_initial_schema.sql)

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `profiles` | User accounts (extends auth.users) | role, full_name, phone, telegram_id, locale |
| `salons` | Multi-master businesses | owner_id, name, address, lat/lng |
| `subscriptions` | Subscription tracking | profile_id OR salon_id, tier, status, trial_ends_at |
| `masters` | Service providers | profile_id, salon_id?, specialization, rating, invite_code |
| `service_categories` | Groups for services | master_id/salon_id, name, color |
| `services` | Service catalog | master_id, name, duration_minutes, price, upsell_services, inventory_recipe |
| `clients` | Client cards (per master) | profile_id?, master_id, full_name, allergies[], behavior_indicators[] |
| `appointments` | Bookings | client_id, master_id, service_id, starts_at, ends_at, status |
| `equipment` | Shared resources (lasers etc.) | salon_id, name, total_resource, used_resource |
| `inventory_items` | Stock/consumables | master_id, name, quantity, unit, cost_per_unit |
| `inventory_usage` | Auto-deduction log | item_id, appointment_id, quantity_used |
| `payments` | Payment records | appointment_id, amount, type, status, liqpay_order_id |
| `reviews` | Anonymous ratings | target_type (master/client), score (1-5) |
| `referrals` | Referral tracking | referrer_client_id, referred_client_id, bonus_points |
| `consent_forms` | Digital consent | client_id, form_text, client_agreed |
| `client_files` | Photos/PDFs (Business tier) | client_id, file_url, is_before_photo, paired_with |
| `waitlist` | Slot waitlist | client_id, master_id, desired_date |
| `gift_certificates` | Gift codes | code, amount, is_redeemed |
| `guilds` | Master cross-marketing groups | name, created_by |
| `guild_members` | Guild membership | guild_id, master_id |
| `notifications` | Notification queue | profile_id, channel, title, body, status |
| `client_master_links` | Client follows master | profile_id, master_id |

## Added by later migrations
- `00002_auth_trigger.sql` — `handle_new_user()` trigger (auto-creates profile/master/salon/trial subscription on signup)
- `00003_expenses.sql` — `expenses`
- `00004_feed.sql` — `feed_posts`
- `00005_family.sql` — `family_links`
- `00006_recurring.sql` — `recurring_bookings`
- `00007_queue.sql` — `queue_entries`
- `00008_groups.sql` — `group_sessions` + `is_group`/`max_participants`/`group_session_id` columns
- `00009_packages.sql` — `service_packages`, `client_packages`
- `00010_products.sql` — `products`, `product_recommendations`, `product_orders`
- Plus column alters for: `cancellation_policy`, `is_mobile`/`service_radius_km`/travel fees, `service_variations`, `master_locations`, `currency_rates`, `translations_cache`, `birthday_auto_greet`/`birthday_discount_percent`, `recurring_interval` on expenses, `monthly_revenue_goal`, `push_subscription` on profiles

## Storage buckets
- `client-files` (private) — client photos/PDFs, Business tier
- `avatars` (public)

## Subscription tiers (defined in `src/types/index.ts` → `SUBSCRIPTION_CONFIG`)

| Feature | Starter $12 | Pro $29 | Business $49 |
|---------|:-----------:|:-------:|:------------:|
| Max clients | 50 | 300 | Unlimited |
| Max masters | 1 | 3 | Unlimited |
| Calendar + booking | ✓ | ✓ | ✓ |
| Client cards (basic) | ✓ | ✓ | ✓ |
| Reminders (24h, 2h) | ✓ | ✓ | ✓ |
| Basic finance stats | ✓ | ✓ | ✓ |
| Waitlist | — | ✓ | ✓ |
| Auto-upsell | — | ✓ | ✓ |
| Referral system | — | ✓ | ✓ |
| Inventory | — | ✓ | ✓ |
| Consent forms | — | ✓ | ✓ |
| Allergies tracking | — | ✓ | ✓ |
| Extended analytics | — | ✓ | ✓ |
| Auto-messages | — | ✓ | ✓ |
| Family accounts | — | ✓ | ✓ |
| Burning slots promos | — | ✓ | ✓ |
| AI features | — | — | ✓ |
| Behavior indicators | — | — | ✓ |
| File storage | — | — | ✓ |
| Equipment booking | — | — | ✓ |
| Cross-marketing (guilds) | — | — | ✓ |
| Auto-reports | — | — | ✓ |
| Currency tracking | — | — | ✓ |
| Before/After slider | — | — | ✓ |
| Gift certificates | — | — | ✓ |
| Product storefront | — | — | ✓ |
| Lost revenue AI | — | — | ✓ |

**Trial = 14 days with ALL features unlocked.**
