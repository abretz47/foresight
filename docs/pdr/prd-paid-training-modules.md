# PRD: Paid Training Modules

## Problem Statement

Foresight currently offers free shot recording and analysis for local and cloud users, but there is no way to monetize premium training content or deliver proprietary interactive drill experiences. Coaches and content creators need a paid content channel that keeps the core app open source while protecting training IP, and users need a clear purchase path that works on web and native platforms.

Users who want structured, interactive training drills cannot access them today. There is no entitlement system, no payment flow, and no mechanism to deliver proprietary module content separately from the open-source host app.

## Solution

Add a **Training Modules** feature accessible from a new hamburger menu entry. Access requires a Supabase cloud account. Individual training modules each require their own entitlement (`training:{slug}`); there is no separate base platform-access gate.

- **Web users** → navigate directly to **Training Home**, a card-style grid showing all published modules. Modules the user owns show a **View** button; modules they do not own show a **Buy** button that opens Stripe Checkout.
- **Native users with at least one training entitlement** → navigate to **Training Home**. Owned modules show a **View** button; unowned modules show a **Buy** button that opens a modal to redirect to the web purchase page.
- **Native users with no training entitlements** → see a modal with a link to the web Purchase Page; after purchase, deep link back to the app with session refresh on focus as fallback.
- **Users with a module entitlement** → tap **View** on a module card to open **Training Module** overview, then start the drill.

**Content delivery (simplified):**

- **React UI (the IP)** ships as **private npm/git dependencies**, imported at **build time** in a proprietary app build. The open-source repo contains only the training framework (registry, config client, drill shell) — not the paid module components.
- **Module content (data)** is delivered as a **full manifest** (metadata + drill definition + asset URLs) over a **Supabase Edge Function** REST API, gated by JWT entitlements.
- At runtime, the app resolves `slug → React component` from the build-time registry, fetches the manifest from the API, and passes config into the component.

Purchases are processed via **Stripe one-time payments**. A Supabase Edge Function handles Stripe webhooks and writes to a `user_entitlements` table. A Supabase Auth Hook injects entitlements into the JWT at token issue time.

## User Stories

1. As a local-only user, I want to see a clear prompt to sign in or create a cloud account when I tap Training Modules, so that I understand why paid content requires cloud auth.
2. As a cloud user without any training entitlements, I want the app to direct me to purchase options on native, so that I can unlock training features.
3. As a web user, I want to land on Training Home when I tap Training Modules, so that I can browse all modules and buy the ones I want.
4. As a native user without any training entitlements, I want a modal with a link to the web Purchase Page, so that I can complete purchase in my device browser.
5. As a native user who just purchased on web, I want the app to deep link back to Training Home and refresh my session, so that my new entitlements appear without manual logout.
6. As a cloud user with at least one training entitlement on native, I want to open Training Home from the menu, so that I can see all available training modules.
7. As a user browsing Training Home, I want to see all modules in a familiar card grid with View or Buy buttons, so that I can discover and purchase content easily.
8. As a user on web, I want unowned modules to show a Buy button that opens Stripe Checkout, so that I can purchase directly in the browser.
9. As a native user, I want unowned modules to show a Buy button that opens a purchase modal, so that I am directed to the web to complete purchase.
10. As a user who owns a module, I want to tap its View button and see a Training Module overview screen, so that I understand what the drill covers before starting.
11. As a user who owns a module, I want to tap Start Drill and have the app load the module manifest and render the drill, so that I get the full interactive experience.
12. As a user on any platform, I want drills to run as native React screens (not WebViews), so that the experience is consistent with the rest of the app.
13. As a user who purchased a module, I want the manifest cached after first fetch, so that repeat sessions start quickly.
14. As an anonymous web visitor, I want to browse the Purchase Page catalog without logging in, so that I can evaluate offerings before creating an account.
15. As a web visitor ready to buy, I want to be prompted to log in or sign up at checkout, so that the purchase is tied to my Supabase account.
16. As a buyer, I want to pay via Stripe Checkout with a one-time payment per module, so that I can buy individual modules as needed.
17. As a buyer, I want my entitlements granted automatically after successful payment, so that I can access content immediately after session refresh.
18. As a returning user, I want my JWT to include all my entitlements, so that the app can gate content without extra round trips.
19. As a content maintainer, I want module React components in a private package repo, so that UI IP stays out of the open-source codebase.
20. As a content maintainer, I want to publish module manifests via the backend API, so that drill copy, steps, and parameters can be updated without an app store release when possible.
21. As a content maintainer, I want manifest asset URLs for images/video hosted on CDN or Storage, so that media can update independently of the app binary.
22. As an admin, I want to manage module metadata, manifests, and Stripe Price IDs in Supabase and Stripe dashboards, so that I can operate without in-app admin UI.
23. As a developer, I want a stable module component contract (props/context for config + host APIs), so that private packages integrate predictably with the open-source host.
24. As a developer, I want a flexible drill manifest schema, so that future module types can be added without rewriting the host app.
25. As a v1 adopter, I want a seeded test module in the framework build, so that the purchase and config pipeline can be validated before real content ships.
26. As a user without network access, I want a cached manifest to load if previously fetched, so that I can continue a drill I already started (within cache TTL).
27. As a user without network and no cache, I want a clear error that content requires connectivity, so that I am not stuck on a blank screen.
28. As a cloud user, I want Training Modules gated consistently across web and native, so that behavior is predictable on every platform.
29. As a security-conscious operator, I want Stripe webhooks verified and idempotent, so that duplicate events do not double-grant entitlements.
30. As a security-conscious operator, I want the config API to reject requests without the correct module entitlement, so that manifests are not leaked to unpaid users.
31. As an open-source contributor, I want to build and run the app without private module packages, so that the public repo remains fully functional with stub/test content only.
32. As a release engineer, I want proprietary builds to install private packages via CI secrets, so that paid modules are included in store builds but not in the public repo.

## Implementation Decisions

### Entitlement model

- **Per-module gate:** `training:{slug}` where slug matches the module slug in `training_modules` (e.g. `training:putting-gate-drill`). No separate base platform-access entitlement.
- Entitlements stored in a `user_entitlements` table: `user_id`, `entitlement_key`, `type`, `granted_at`, `source`, `stripe_event_id` (unique for idempotency). The `type` column categorises entitlements (e.g. `'training'`) and enables efficient queries such as "does this user have any training entitlement?".
- A database trigger syncs `user_entitlements` into `auth.users.raw_app_meta_data.entitlements`, making the claim available on token issue/refresh.
- App reads entitlements from JWT via **EntitlementService**; triggers `refreshSession()` on app focus after purchase (native fallback when deep link fails).

### Navigation and gating

- New hamburger menu item: **Training Modules**.
- **TrainingAccessGate** (single entry point):
  1. If not cloud mode → prompt to sign in / create cloud account.
  2. If cloud, web → navigate to Training Home (per-module Buy buttons handle gating).
  3. If cloud, native, no training entitlements → show PurchasePromptModal with web URL.
  4. If cloud, native, has any training entitlement → navigate to Training Home.
- Purchase Page is **web-only** (native users reach it via browser link from modal).
- Native PurchasePromptModal opens device browser to `{WEB_APP_URL}/purchase`.

### Screens

- **TrainingHome** — 2-column FlatList card grid patterned after HomeScreen; fetches catalog metadata from Supabase; each card shows a **View** button (owned) or **Buy** button (unowned). On native, Buy opens PurchasePromptModal; on web, Buy opens Stripe Checkout.
- **TrainingModule** — overview (title, description, thumbnail from catalog); Start Drill button for owned modules only.
- **DrillRunner** — resolves registered React component for slug, fetches manifest from config API, renders drill.
- **PurchasePage** (web) — lists all published modules with title, description, and price; anonymous browse; login required at Buy/Checkout; Stripe Checkout Session per module.
- **PurchasePromptModal** (native) — informational modal + link to web Purchase Page.

### Content delivery (build-time components + REST config)

#### Build-time module packages (IP)

- Each training module (or module family) is a **private npm/git package** exporting a React component (e.g. `@foresight/training-putting-gate`).
- **Proprietary builds** add these as dependencies and register them in **TrainingModuleRegistry** (`slug → Component`).
- **Open-source builds** register only a **stub/test module**; no private packages required to compile or run.
- Module components receive:
  - **manifest** — full config from API (drill steps, copy, parameters, asset URLs)
  - **host context** — typed access to host APIs (shot profiles, recording, navigation) via React context provided by the open-source framework

#### REST config API

- Supabase Edge Function **`training-module-config`**: `GET /training-modules/{slug}/config`
  - Requires valid Supabase JWT.
  - Verifies caller has `training:{slug}` entitlement (from JWT claims injected by Auth Hook).
  - Returns **full manifest** JSON on success; 403 if not entitled; 404 if module unpublished.
- Manifest schema (v1) includes:
  - Module metadata (title, description, version, estimated duration)
  - Drill definition (steps, parameters, completion criteria)
  - Asset references (image/video URLs — may point to Supabase Storage or CDN; assets are not the primary IP layer)
- Manifests stored in Supabase (`training_module_configs` table: `module_slug`, `version`, `manifest jsonb`, `published_at`) or authored in dashboard; Edge Function reads from DB.
- **TrainingConfigService** (deep module): fetch manifest, cache locally keyed by `slug + version`, invalidate on version bump.

#### Catalog vs config split

- **Catalog (public metadata)** — `training_modules` table: slug, title, description, thumbnail_url, stripe_price_id, sort_order, is_published. Used by Training Home and Purchase Page (no entitlement required for listing).
- **Config (entitlement-gated)** — full manifest via Edge Function only when user owns the module.

### Payment backend

- Stripe Products/Prices managed in Stripe Dashboard.
- `training_modules.stripe_price_id` references Stripe Price ID per module.
- Edge Function **stripe-webhook**: verify signature, handle `checkout.session.completed`, insert `user_entitlements` rows idempotently.
- Post-checkout: web redirect to success page; native deep link `foresight://training` (or universal link) + session refresh on focus.

### Database schema (Supabase)

- `training_modules`: id, slug (unique), title, description, thumbnail_url, stripe_price_id, component_key, sort_order, is_published, created_at, updated_at
- `training_module_configs`: id, module_slug (FK), version, manifest (jsonb), published_at, is_active
- `user_entitlements`: user_id, entitlement_key, **type** (text, default `'training'`), granted_at, source, stripe_event_id (unique)

Note: `component_key` maps to an entry in TrainingModuleRegistry (allows multiple slugs to share one component if needed).

### Modules to build/modify

1. **EntitlementService** (deep) — parse JWT claims, `hasEntitlement(key)`, `hasAnyEntitlementOfType(type)`, `refreshSession()`
2. **TrainingAccessGate** (deep) — platform-aware routing for menu entry
3. **TrainingCatalogService** — fetch published module list from Supabase
4. **TrainingConfigService** (deep) — fetch + cache entitlement-gated manifests from Edge Function
5. **TrainingModuleRegistry** (deep) — build-time registration map `slug → React component`; stub in OSS build
6. **TrainingHostContext** — React context exposing host APIs to module components
7. **DrillRunner** — orchestrates registry lookup + config fetch + render
8. **StripeWebhookHandler** (Edge Function) — idempotent entitlement grants
9. **TrainingModuleConfigHandler** (Edge Function) — JWT + entitlement check, return manifest
10. **EntitlementMetadataSync** — trigger-driven sync from `user_entitlements` into `auth.users.raw_app_meta_data`
11. UI: TrainingHome (View/Buy cards), TrainingModule, DrillRunner screen, PurchasePage, PurchasePromptModal
12. HamburgerMenu + stack navigator registration
13. Supabase migrations: tables (including `type` column on `user_entitlements`), Auth Hook config

### Build pipeline (proprietary)

- CI (e.g. EAS Build) with access to private registry token installs paid packages.
- Registry file (e.g. `trainingModuleRegistry.proprietary.ts`) imported only in proprietary build via env flag or file swap; gitignored in public repo.
- Open-source CI builds without private deps; uses `trainingModuleRegistry.stub.ts`.

## Testing Decisions

- **Philosophy:** Test external behavior only. Given auth state, platform, and entitlements, assert the correct navigation target and config access behavior. Do not test internal JWT parsing beyond the public EntitlementService API.
- **Modules tested in v1:**
  - **TrainingAccessGate** — navigation gating with mocked EntitlementService (`hasAnyEntitlementOfType`), cloud mode, and Platform.
- **Prior art:** Mirror existing app test patterns where available.
- **Deferred (manual QA in v1):** Stripe webhook, Auth Hook, Edge Function config endpoint, proprietary package integration.

## Out of Scope

- Native in-app purchases (Apple/Google IAP)
- Runtime-loaded JS bundles, WebView module containers, or Supabase Storage for module code
- Automated refund handling and entitlement revocation
- Module bundles / volume discounts
- Cross-device drill progress sync to cloud
- Purchase analytics dashboard
- In-app admin UI (Supabase + Stripe dashboards only)
- Real training content in v1 (framework + stub module + seeded test manifest only)
- Offline-first sync beyond simple post-fetch manifest cache
- App store updates triggered automatically when manifest changes (manifest updates are server-side; app update only needed when new module *components* are added)

## Further Notes

### Why this is simpler

| Previous approach | New approach |
|---|---|
| Remote JS bundles from Storage | React components bundled at build time |
| WebView + HostBridge on native | Native React screens everywhere |
| Signed URLs + Storage RLS for code | Edge Function returns JSON manifest |
| Private repo CI uploads bundles | Private npm packages in proprietary CI build |
| ModuleLoader runtime complexity | TrainingModuleRegistry + TrainingConfigService |
| Separate paid-content-user base gate | Per-module entitlements only; no base gate |

### When an app release is required

- **Not required:** manifest copy, drill steps, parameters, asset URL changes (update DB/config).
- **Required:** new module slug with a new React component (add private package + registry entry + store build).

### Environment variables (new)

- `EXPO_PUBLIC_WEB_APP_URL`
- Stripe keys (publishable on web; secret + webhook secret in Edge Functions)
- Supabase service role key (Edge Functions only)
- `NPM_TOKEN` or private registry credentials (proprietary CI only, not in client)

### v1 seeded test data

- Stub registry component (`test-drill`) in open-source repo
- Test manifest in `training_module_configs` for `test-drill`
- Stripe test mode Price IDs for test module
- QA entitlements grantable via webhook or admin SQL
