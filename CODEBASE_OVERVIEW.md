# Noble Coin Launch – Codebase & DB Overview

This document describes how the app works with **Supabase** (auth, DB, RLS, functions) and the **database structure** so changes can be made safely.

---

## 1. Tech stack

- **Frontend:** React 18, Vite, TypeScript, React Router, TanStack Query, Tailwind, shadcn/ui, Framer Motion.
- **Backend/DB:** Supabase (Postgres, Auth, Realtime, Edge Functions, Storage).
- **Payments:** M-PESA (STK Push, B2C payout) via Supabase Edge Functions.

---

## 2. Supabase client & auth

- **Client:** `src/integrations/supabase/client.ts`
  - Uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
  - Typed with `Database` from `src/integrations/supabase/types.ts`.
  - Auth: `localStorage`, `persistSession: true`, `autoRefreshToken: true`.

- **Auth context:** `src/lib/auth-context.tsx`
  - `supabase.auth.onAuthStateChange` + `getSession()` drive `user`, `session`, `loading`.
  - **Roles** come from `user_roles` (not profiles): `fetchUserRoles(userId)` → `roles`, `isAdmin`, `isSuperAdmin`.
  - **Role enum:** `super_admin | admin | coin_creator | user | banned`.
  - Sign up/in/out: `signUp`, `signIn`, `signOut` (email/password).

- **Protected routes:** `src/components/auth/ProtectedRoute.tsx`
  - No user → redirect to `/auth`.
  - `requireAdmin` → only `admin` or `super_admin` can access (e.g. `/admin`).

---

## 3. Database structure (public schema)

### 3.1 Core tables

| Table | Purpose |
|------|--------|
| **profiles** | Extended user info: `user_id` (FK auth.users), email, full_name, phone, avatar_url, referral_code, referred_by. |
| **user_roles** | RBAC: `user_id`, `role` (app_role). One user can have multiple rows (multiple roles). |
| **coins** | Tokens: creator_id, name, symbol, description, logo_url, price, total_supply, circulating_supply, market_cap, liquidity, holders_count, volatility, bonding (initial_price, bonding_curve_factor, burned_supply), approval/creation flags, trading_paused, etc. |
| **holdings** | User balances per coin: user_id, coin_id, amount, average_buy_price. UNIQUE(user_id, coin_id). |
| **wallets** | Fiat balance per user: user_id (UNIQUE), fiat_balance. |
| **transactions** | All monetary flows: user_id, coin_id (nullable for deposit/withdrawal), type, amount, price_per_coin, total_value, status, phone, mpesa_receipt, checkout_request_id, merchant_request_id, error_reason. |
| **commission_transactions** | Platform commission per transaction: transaction_id, amount, commission_rate. |
| **withdrawal_requests** | Withdrawals: user_id, amount, phone, status, withdrawal_fee, mpesa_receipt, admin_notes, approved_by, etc. |
| **mpesa_config** | M-PESA credentials (paybill, passkey, consumer key/secret, callback URL, is_sandbox). |
| **site_settings** | Single-row config: site name, hero/features/stats/CTA, fees, limits, referral_commission_percentage, withdrawal_fee_percentage, min/max withdrawal, etc. |
| **referrals** | referrer_id, referred_id. |
| **referral_commissions** | referral_id, transaction_id, amount. |
| **price_history** | Time series per coin: coin_id, price, circulating_supply, market_cap, volume_24h, holders_count. |

### 3.2 Transaction types and statuses

- **Transaction type:** `buy | sell | allocation | burn | deposit | coin_creation`.
- **Transaction status:** `pending | processing | completed | failed | cancelled | stk_sent`.
- **coin_id:** Can be NULL for `deposit` (and similar non-coin flows).

### 3.3 Critical DB functions (RPC / triggers)

- **has_role(_user_id, _role), is_admin(_user_id):** SECURITY DEFINER; used by RLS.
- **handle_new_user():** Trigger on `auth.users` INSERT → creates profile, user_roles (default `user`), and **wallet**.
- **update_holdings_from_transaction():** Trigger on transactions INSERT/UPDATE when status becomes `completed` and type is `buy` or `sell`:
  - **Buy:** upsert holdings, increase coin circulating_supply and holders_count.
  - **Sell:** decrease holding (or delete if amount ≤ 0), decrease circulating_supply and holders_count.
- **update_coin_price_from_transaction():** Trigger on transactions when status = `completed` and type in (`buy`, `sell`) → updates coin price/volatility via bonding curve.
- **update_coin_metrics():** Trigger on completed buy/sell → updates coin metrics and **price_history**.
- **process_wallet_buy(p_user_id, p_coin_id, p_amount):** SECURITY DEFINER. Debits wallet (with fee from site_settings), inserts completed `buy` transaction, inserts commission_transactions. Holdings/price updated by triggers.
- **process_wallet_sell(p_user_id, p_coin_id, p_amount):** SECURITY DEFINER. Checks holdings, inserts completed `sell` transaction, inserts commission, credits wallet (minus fee). Triggers update holdings and price.
- **ensure_wallet_exists():** Trigger on transactions: when type = `deposit` and status = `completed`, upserts wallet and adds total_value. (Note: M-PESA callback also credits wallet for `deposit`; ensure no double-credit.)
- **calculate_bonding_price** / **calculate_bonding_curve_price:** Used for price curves.

---

## 4. RLS (Row Level Security) – summary

- **profiles:** Users own their row; admins can read/update all.
- **user_roles:** Users see own roles; only super_admin can INSERT/UPDATE/DELETE.
- **coins:** Public read for active coins; creators see own; admins see all. Insert: creator or admin. Update: creator or admin. Delete: super_admin only.
- **holdings:** Users own their rows; admins full access.
- **wallets:** Users update own row; admins full access; “System can insert/update” for service role/triggers.
- **transactions:** Users create/read own; admins full access.
- **withdrawal_requests:** Users create/read own; admins full access.
- **mpesa_config:** Admin read; super_admin manage.
- **site_settings:** Everyone read; super_admin manage.
- **commission_transactions:** Admin read; super_admin manage.
- **price_history:** Public read.
- **storage (coin-logos):** Public read; admins insert/update/delete.

---

## 5. Critical app flows

### 5.1 Auth and roles

1. User signs up/in via `Auth.tsx` → Supabase Auth.
2. `handle_new_user` creates profile, default role `user`, and wallet.
3. Auth context loads roles from `user_roles` → `isAdmin` / `isSuperAdmin` drive UI and ProtectedRoute.

### 5.2 Create coin

1. User creates coin (CreateCoin) → insert into `coins` (creator_id = user, approval_status, creation_fee_paid, etc.).
2. Creation fee: insert `transactions` (type `coin_creation`, coin_id set, status `pending`), then M-PESA STK push.
3. M-PESA callback on success → update `coins`: `creation_fee_paid = true`, `approval_status = 'pending'`, `is_active = true`.
4. Optionally promote user to `coin_creator` role after first coin.

### 5.3 Buy with wallet

1. CoinDetail (or similar) calls `supabase.rpc('process_wallet_buy', { p_user_id, p_coin_id, p_amount })`.
2. RPC debits wallet (with fee), inserts completed `buy` transaction and commission; triggers update holdings and coin price/metrics.

### 5.4 Buy with M-PESA (no wallet balance)

1. Insert `transactions` (type `deposit`, coin_id set, total_value = amount + fee, status `pending`).
2. Invoke `mpesa-stk-push` with transaction id and phone.
3. Store `checkout_request_id` on transaction (and optionally status `stk_sent`).
4. Poll `query-mpesa-status` or rely on Realtime; when callback sets status to `completed`:
   - M-PESA callback credits wallet for type `deposit`.
   - Frontend then calls `process_wallet_buy` to complete the buy from wallet (e.g. CoinDetail “autoWalletBuy” after deposit completes).

### 5.5 Deposit only (wallet top-up)

1. WalletCard: insert `transactions` (type `deposit`, coin_id **null**, total_value = amount, status `pending`).
2. STK push; callback finds transaction by `checkout_request_id`, sets status `completed`, updates wallet balance in callback (and possibly trigger `ensure_wallet_exists` – avoid double-credit).

### 5.6 Sell to wallet

1. CoinDetail calls `supabase.rpc('process_wallet_sell', { p_user_id, p_coin_id, p_amount })`.
2. RPC updates holdings, inserts completed `sell` and commission, credits wallet (minus fee). Triggers handle supply and price.

### 5.7 Withdrawal

1. WalletCard: insert `withdrawal_requests` (user_id, amount, phone, withdrawal_fee, status `pending`).
2. App immediately debits `wallets` (user’s fiat_balance -= amount). Admin later approves; B2C payout via `mpesa-b2c-payout`; update withdrawal_requests and optionally wallet if rejected.

---

## 6. Edge functions (Supabase)

- **mpesa-stk-push:** STK push; expects transactionId, phone, amount, type, accountReference.
- **mpesa-callback:** Receives M-PESA result; finds transaction by `checkout_request_id`; updates status/mpesa_receipt/error_reason; for `completed`: coin_creation → update coin; deposit → credit wallet.
- **query-mpesa-status:** Polling helper; uses CheckoutRequestID to query M-PESA and update transaction.
- **mpesa-b2c-payout:** Used for withdrawal payouts (admin flow).
- **check-transaction-status:** Transaction status checks.

---

## 7. What not to break

1. **Auth → user_roles:** All role checks go through `user_roles` and RLS helpers `has_role` / `is_admin`. Do not bypass or duplicate in app-only checks.
2. **Transaction flow:** Buy/sell must go through either `process_wallet_buy` / `process_wallet_sell` or through insert + callback; triggers assume `completed` + type `buy`/`sell` for holdings and price.
3. **Deposit vs buy:** Deposit uses type `deposit` and may have `coin_id` null (top-up) or set (buy-via-M-PESA). Callback and trigger both can touch wallet for `deposit` – avoid double-credit.
4. **coin_id nullable:** Required for deposit/withdrawal-style rows; keep migrations and types in sync.
5. **RLS:** Any new table or new operation must have correct RLS policies; service role is used in Edge Functions only where intended.
6. **Types:** `src/integrations/supabase/types.ts` should match DB (tables, RPCs, enums). If you add tables/RPCs (e.g. withdrawal_requests, process_wallet_buy/sell), regenerate or update types.
7. **Wallet creation:** New users get a wallet only via `handle_new_user`. Do not assume wallet exists for arbitrary auth.users without a corresponding wallets row.

---

## 8. File reference (key files)

- **Supabase:** `src/integrations/supabase/client.ts`, `types.ts`
- **Auth:** `src/lib/auth-context.tsx`, `src/components/auth/ProtectedRoute.tsx`, `src/pages/Auth.tsx`
- **Settings:** `src/lib/site-settings-context.tsx` (site_settings)
- **Flows:** `src/pages/CreateCoin.tsx`, `src/pages/CoinDetail.tsx`, `src/pages/Dashboard.tsx`, `src/components/wallet/WalletCard.tsx`
- **Admin:** `src/pages/Admin.tsx`, `src/components/admin/*`
- **Migrations:** `supabase/migrations/*.sql` (order matters; do not change applied migrations; add new ones for changes)

Use this overview when changing auth, roles, transactions, wallets, or RLS so that existing behavior is preserved and nothing is damaged.
