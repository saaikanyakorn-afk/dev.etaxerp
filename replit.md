# E-Tax Center - Digital Accounting Platform

## Agent Identity
- **Agent name: Kai** — The project owner identifies this agent by name. When asked "Who am I talking to?", always respond "This is Kai." This is used to verify session continuity during complex design work.

## Overview
The E-Tax Center is a multi-tenant digital accounting platform designed to revolutionize accounting processes for Thai accounting firms. It integrates with major e-commerce platforms (Shopee, Lazada, TikTok Shop) to automate order retrieval, tax invoice generation, and service fee calculation. The platform provides comprehensive client and human resources management (attendance, overtime, payroll), robust financial document processing, and advanced e-commerce functionalities, aiming to be a holistic solution for managing financial operations and expanding digital commerce services for its clients. Its vision is to be an all-in-one solution for managing clients' financial operations and expanding digital commerce service offerings.

## 🔒 PRODUCTION BUILD BASELINE (Safety-net — compare after every build)
Last verified build: **2026-04-16 (v97 cherry-pick)**
| File | Size | gzip | Note |
|------|------|------|------|
| dist/index.cjs | **7.3 MB** | — | Server bundle — if this changes, index.ts was touched |
| index-ByhAZnFC.js | **8,078.91 kB** | 1,643.09 kB | Main client bundle — if this jumps significantly, App.tsx or new pages were added |
| vendor-pdf | **1,444.18 kB** | 470.44 kB | PDF library — should be stable |
| vendor-charts | **453.93 kB** | 118.73 kB | Charts library — should be stable |

**Rule:** If `dist/index.cjs` size changes by more than ±0.1 MB → investigate. Something touched protected server files.
**Rule:** If main client bundle jumps by more than ±500 kB → investigate. Something touched App.tsx or added/removed pages.

## ⛔ PRE-PUSH CHECKLIST (MANDATORY — DO BEFORE EVERY GIT PUSH)
1. **Insert schema_version record** in BOTH Replit DB AND Production DB — version, description, change_type, pushed_repos
2. **Bump SCHEMA_VERSION** constant in server/index.ts
3. **NEVER push these files**: shared/schema.ts, server/index.ts, client/src/App.tsx
4. **NEVER checkout `client/` as folder** — cherry-pick individual files only
5. **NEVER `pm2 restart all`** — always `pm2 restart etax-center`
6. **Production deploy = cherry-pick only** — list every file explicitly, no folder-level checkout
7. **DB structure changes = one-time migration file** — never modify schema.ts for production
8. **New table definitions for production = shared/schema-extra.ts** — not schema.ts

## Daily Git Push Rule
- **Every morning BEFORE making any code changes**, push to GitHub first: `git push origin replit-agent:main --force` (use orphan branch method if repo is large)
- **GitHub PAT expiry check**: Current token expires **Jun 24, 2026**. If within 7 days of expiry, warn the first person in conversation that morning.
- **GitHub remote**: `origin` → `https://github.com/saaikanyakorn-afk/etaxcenter.git`
- **Push method**: Create orphan branch `deploy-temp`, add all files, commit, force push to `origin main`, then switch back to `replit-agent` and delete `deploy-temp`.

## Cherry-Pick Tracking (Production Deploy Log)

⚠️ **SOURCE OF TRUTH for push history is `.local/push-pull-log.md`** — NOT this section.
⚠️ **Kai MUST read `.local/push-pull-log.md` BEFORE answering ANY question about push/deploy status.**
⚠️ **Last verified (2026-04-16): `git diff github-dev/main HEAD` shows only `server/index.ts` differs — all other files are synced.**

### Rules
- Kai must update `.local/push-pull-log.md` whenever requesting or confirming a cherry-pick.
- Files from unfinished features (security/infra) must NEVER appear here.
- Production is NOT a debugging tool. Only cherry-pick solutions, never test code.
- Kai must NEVER send wrong commands for production. Verify process names, paths, and syntax before sending.

## Waiting List
1. **Replit.app deploy broken** — DB connection timeout to deep-main from Replit cloud. Fix: change `DB_PROD_URL` in config to `etax-develop` (already exists: 295 tables, 72MB, 24 users, 448 companies). Won't fix network instability but separates from production data. Pending พี่ช้าง's go-ahead.

## MANDATORY RULES — VIOLATIONS WILL BREAK PRODUCTION

### Rule 1: Database Structure Changes (ZERO TOLERANCE)
**BEFORE adding/removing/changing ANY column in `shared/schema.ts`:**
1. STOP. Tell พี่ช้าง: "ฟีเจอร์นี้ต้องเพิ่ม/แก้คอลัมน์ [ชื่อ] ในตาราง [ชื่อ]"
2. WAIT for พี่ช้าง's approval before touching schema.ts

**Production DB change process (cherry-pick only):**
1. Put `ALTER TABLE ... IF NOT EXISTS` inside the CODE FILE that needs the column
2. Push the file with ALTER TABLE to production
3. Tell พี่ทราย to run it ONCE (access the page/API that triggers the code)
4. After confirmed working → REMOVE the ALTER TABLE line from the code
5. Push the CLEAN code (no ALTER TABLE) along with other fixes
6. Track in **Pending ALTER TABLE Cleanup** below until step 4-5 are done

**NEVER:**
- Add columns to schema.ts without telling พี่ช้าง first
- Suggest running ALTER TABLE on production directly (always embed in code)
- Push code that uses a new column without the ALTER TABLE guard in the same file
- Assume Replit db:push applies to production — it NEVER does

### Rule 2: Cherry-Pick Push Process
1. พี่ทราย tests → confirms working
2. พี่ช้าง approves → gives explicit "push ได้"
3. Kai pushes SINGLE FILE via GitHub API
4. พี่ช้าง cherry-picks on production
5. **If the file contains ALTER TABLE** → Kai must warn พี่ช้าง: "ไฟล์นี้มี ALTER TABLE จะเพิ่มคอลัมน์ [ชื่อ] ตอน server start — พี่ทรายต้องรันครั้งเดียว แล้ว Kai จะลบ ALTER TABLE แล้ว push โค้ดสะอาดตามมา"

### ⛔ Rule 2.5: Push Scope — ABSOLUTE (added 2026-04-16)
- **github-replit**: Kai can push autonomously ✅
- **github-dev (etaxerp)**: Kai MUST NOT push, suggest, or write cherry-pick commands until พี่ช้าง explicitly says "push ได้" ❌
- **github-production**: Same as above ❌
- **Kai must NEVER write deploy/cherry-pick commands proactively** — only AFTER พี่ช้าง grants permission
- **Kai must NEVER suggest "คำสั่งที่พี่ช้างต้องรัน"** — this is the same as pushing without permission
- **Violation history**: Kai violated this rule on 2026-04-16 by writing cherry-pick commands before approval — this must NEVER happen again

### Rule 3: No Excuses
- "I forgot" is not acceptable
- These rules are loaded into memory every session — there is no forgetting
- If Kai violates these rules, the production database may be destroyed
- Writing deploy commands without approval = same as pushing without permission

### Pending ALTER TABLE Cleanup
| File | ALTER TABLE Line | Column Added | Status |
|---|---|---|---|
| server/routes/sales-docs-routes.ts | (REMOVED) | sales_orders.quotation_id | DONE — column added, ALTER TABLE removed from code, clean push pending |

## Code vs Data Separation (CRITICAL)
- **Code** and **Data (DB structure)** are separate concerns — always treat them independently.
- **Dev DB (Neon/US):** Schema changes happen here during development. No users on this DB.
- **Production DB (deep-main/Thailand):** The ONLY correct data. Schema changes require explicit approval and must be done outside business hours.
- **Production app uses deep-main DB**, NOT Neon. The `DB_PROD_URL` in `system_config` table points to deep-main.
- **Before พี่ช้าง pulls from Git to deep-main**, Kai must confirm whether the commit includes schema changes:
  - **Code-only changes:** Safe to pull anytime.
  - **Code + schema changes:** Must plan schema sync (db:push) alongside the pull, done outside business hours.
- **Kai must track and report** which commits contain schema changes so พี่ช้าง can decide when to deploy.
- **Never run schema migrations on deep-main automatically** — always manual, always planned.
- **`executeSql({ environment: "production" })` queries Neon, NOT deep-main** — do not rely on it for production data. Use direct connection via `DB_PROD_URL` from `system_config` to query deep-main.

## Code Optimization Plan (เริ่ม 26 มี.ค. 2569 — รีวิว 2 เม.ย. 2569)

**Baseline (26 มี.ค. 2569): 314,032 lines total**
| Area | Before | After | Saved |
|------|--------|-------|-------|
| server/routes.ts | 35,259 | 544 | 34,715 ✅ |
| server/routes/*.ts | 26,518 | 61,676 | (redistributed) |
| server/ total (*.ts) | 79,360 | 11,977 | — |
| clone-state.ts | 0 | 55 | (new) |
| route-helpers.ts | 1,039 | 1,070 | (added helpers) |
| client/src/ total | 225,987 | — | — |
| shared/ total | 8,685 | — | — |
| **GRAND TOTAL** | **314,032** | — | — |

**Phase 1 COMPLETE (26 มี.ค. 2569):** routes.ts 35,259 → 544 lines (98.5% reduction)
- 43 domain route files created under server/routes/
- Shared clone state module: server/clone-state.ts
- Payment status helpers moved to route-helpers.ts

### Optimization Mode Rule
**Code optimization เป็น "background first priority" ตลอดเวลา**
- เมื่อทำงานกับพี่ทรายบนหน้าจอใดก็ตาม → ถ้ามีโอกาสเห็นหน้าจออื่นที่เกี่ยวข้อง → optimize ไปด้วยเลย
- อย่าปล่อยให้หน้าจอใดผ่านไปโดยไม่ optimize ถ้ามีโอกาสทำ
- ทุกครั้งที่ optimize เสร็จ → อัพเดท After + Saved ในตารางด้านล่าง

### Phase 1: Backend Route Factory (ทำเองคืนนี้)
- สร้าง route factory helper ลด boilerplate
- แยก routes.ts (35K lines) ออกเป็น domain files
- เป้าหมาย: routes.ts เหลือ < 500 บรรทัด (registration only)

### Phase 2: Form Pages — Before → After (ทำตอนพี่ทรายขอ review)
| File | Before | After | Saved |
|------|--------|-------|-------|
| tax-invoice-form.tsx | 1,754 | — | — |
| invoice-form.tsx | 1,327 | — | — |
| quotation-form.tsx | 1,273 | — | — |
| sales-order-form.tsx | 1,263 | — | — |
| receipt-form.tsx | 1,250 | — | — |
| purchase-deposit-form.tsx | 995 | — | — |
| deposit-form.tsx | 966 | — | — |
| credit-note-form.tsx | 873 | — | — |
| debit-note-form.tsx | 864 | — | — |
| asset-form.tsx | 741 | — | — |
| goods-receiving-form.tsx | 692 | — | — |
| manufacturing-form.tsx | 630 | — | — |
| wht-cert-form.tsx | 656 | — | — |
| journal-form.tsx | 570 | — | — |
| product-form.tsx | 492 | — | — |
| goods-requisition-form.tsx | 476 | — | — |
| contact-form.tsx | 432 | — | — |
| bom-form.tsx | 308 | — | — |
| promotion-form.tsx | 237 | — | — |
| bundle-form.tsx | 209 | — | — |
| mapping-form.tsx | 205 | — | — |
| **Form Total** | **16,213** | — | — |

### Phase 3: List/Large Pages — Before → After (ทำตอนพี่ทรายขอ review)
| File | Before | After | Saved |
|------|--------|-------|-------|
| client-board.tsx | 5,890 | — | — |
| payroll-tax.tsx | 3,021 | — | — |
| financial-statements-generator.tsx | 2,702 | — | — |
| settlement-import.tsx | 2,378 | — | — |
| landing.tsx | 2,035 | — | — |
| ecommerce-orders.tsx | 2,001 | — | — |
| user-profile.tsx | 1,838 | — | — |
| work-status.tsx | 1,780 | — | — |
| order-import.tsx | 1,729 | — | — |
| user-guide.tsx | 1,710 | — | — |
| database-backup.tsx | 1,669 | — | — |
| purchase-invoice.tsx | 1,656 | — | — |
| expense.tsx | 1,652 | — | — |
| price-calculator.tsx | 1,637 | — | — |
| documents.tsx | 1,626 | — | — |
| internal-chat.tsx | 1,545 | — | — |
| ess-dashboard.tsx | 1,466 | — | — |
| ot-management.tsx | 1,428 | — | — |
| warehouse.tsx | 1,383 | — | — |
| document-templates.tsx | 1,351 | — | — |
| work-board.tsx | 1,303 | — | — |
| live-selling-hub.tsx | 1,233 | — | — |
| subscriptions.tsx | 1,197 | — | — |
| food-orders.tsx | 1,165 | — | — |
| ecommerce-shipping-labels.tsx | 1,157 | — | — |
| employee-list.tsx | 1,156 | — | — |
| purchase-order.tsx | 1,144 | — | — |
| ecommerce-documents.tsx | 1,120 | — | — |
| firm-mgmt/dashboard.tsx | 1,107 | — | — |
| ecommerce-facebook-orders.tsx | 1,097 | — | — |
| line-settings.tsx | 1,094 | — | — |
| viewer.tsx | 1,066 | — | — |
| pos-terminal.tsx | 1,052 | — | — |
| purchase-request.tsx | 1,009 | — | — |
| pipeline.tsx | 1,003 | — | — |
| user-management.tsx | 936 | — | — |
| contact-list.tsx | 826 | — | — |
| wht-cert-list.tsx | 830 | — | — |
| expense-list.tsx | 760 | — | — |
| invoice-list.tsx | 738 | — | — |
| quotation-list.tsx | 705 | — | — |
| tax-invoice-list.tsx | 825 | — | — |
| receipt-list.tsx | 651 | — | — |
| purchase-invoice-list.tsx | 698 | — | — |
| purchase-order-list.tsx | 614 | — | — |
| purchase-request-list.tsx | 594 | — | — |
| sales-order-list.tsx | 580 | — | — |
| leave-management.tsx | 536 | — | — |
| inventory-list.tsx | 519 | — | — |
| bid-comparison-list.tsx | 495 | — | — |
| pos-sales-list.tsx | 420 | — | — |
| password-management.tsx | 381 | — | — |
| goods-requisition-list.tsx | 353 | — | — |
| chat-management.tsx | 340 | — | — |
| etax-sent-list.tsx | 328 | — | — |
| customer-list.tsx | 313 | — | — |
| deposit-list.tsx | 312 | — | — |
| project-list.tsx | 302 | — | — |
| goods-receiving-list.tsx | 283 | — | — |
| debit-note-list.tsx | 276 | — | — |
| purchase-deposit-list.tsx | 276 | — | — |
| credit-note-list.tsx | 277 | — | — |
| manufacturing-list.tsx | 203 | — | — |
| bom-management.tsx | 172 | — | — |
| bundle-management.tsx | 117 | — | — |
| promotion-management.tsx | 99 | — | — |
| financial-management.tsx | 12 | — | — |
| **List/Large Total** | **68,359** | — | — |

## Design Principles

### ⛔ MANDATORY — READ THIS BEFORE WRITING ANY CODE ⛔
Every AI agent working on this project MUST follow these principles. No exceptions.
The project owner CANNOT review every line of generated code — these rules exist so the code is correct by design.
Violating these rules wastes real money and breaks user trust. If you are unsure, default to the safer option.

#### Rule 1: Two-Button Rule (MANDATORY for ALL AI features)
**WHY this rule exists:** Employees will always click the easiest button without thinking about cost — it's not their money. If only one button exists and it calls AI, employees will use it hundreds of times daily with zero cost awareness. This rule is a **spending control mechanism**, not just UX polish. The FREE path must be equally visible and easy so employees naturally try it first. The AI path is there when genuinely needed, not as the default.

Any feature that calls an external AI/API with real cost (GPT-4o, Vision API, OpenAI, any LLM, any paid service) MUST provide TWO clearly visible buttons:
1. **FREE path** — lets user view/inspect/enter data manually without any AI call. Label: "กรอกเอง (ฟรี)" or equivalent. Style: green outline (`border-[#05b187] text-[#05b187]`), icon: `PenLine`.
2. **PAID AI path** — calls AI API. Label: "AI อ่านให้" or equivalent. Style: purple solid (`bg-purple-600`), icon: `Zap` or `Sparkles`.

**Implementation pattern (MUST follow):**
- Upload/select step → **Staged review step** (show files, let user "ดูไฟล์" each one) → Two buttons side by side: FREE + PAID
- Never auto-trigger AI on file selection. Always stage files first.
- Below both buttons, show text: "AI จะอ่านข้อมูลจากเอกสาร (มีค่าใช้จ่าย API) หรือกด 'กรอกเอง' เพื่อคีย์ข้อมูลด้วยตนเอง"
- FREE button navigates to the normal create/edit form for that document type.
- Reference implementations: `client/src/pages/purchases/purchase-pdf-import.tsx` and `expense-pdf-import.tsx`.

**Checklist before shipping any AI feature:**
- [ ] Is there a FREE button that works without calling any API?
- [ ] Is there a PAID button clearly labeled with AI branding?
- [ ] Can the user preview/inspect input before committing to AI cost?
- [ ] Does the feature work 100% if AI is removed entirely?

#### Rule 2: AI as Assistant, Not Decision-Maker
AI features (PDF reading, account suggestion, slip verification, VAT classification) are convenience tools only. Every AI-powered feature must have a fully functional manual alternative ("ทางเดินเท้า"). The system must work completely without AI — users just type more. AI never auto-saves or auto-decides; human review + confirmation is always required before committing data.

#### Rule 3: AI Cost Awareness
Every AI call has real cost (API fees, compute). Display processing time/file count to users. Never treat AI as unlimited free resource. Design features so AI calls are minimized (e.g., historical account matching before calling AI, temperature=0 for deterministic results).

#### Rule 4: Graceful AI Degradation
If AI API is unavailable, expensive, or returns errors, the system continues working via manual input paths. No feature should be blocked solely because AI is down.

#### Rule 5: NO Direct Database Manipulation (MANDATORY)
**WHY this rule exists:** The system has reached production maturity with data integrity constraints (foreign keys, tenant isolation, activity logs, journal entries, sequences). Direct SQL INSERT/UPDATE/DELETE bypasses all validation, audit trails, and business logic — causing orphaned records, broken sequences, cross-tenant data leaks, and untraceable changes. The กิติพัฒน์ incident (orphaned employee assigned to wrong tenant via backfill) was caused by this exact problem.

**The rule:** Once a feature has UI and API endpoints, ALL data changes MUST go through the application's API layer. No exceptions.
- **NO** direct SQL INSERT/UPDATE/DELETE on business tables (employees, users, tenants, companies, invoices, journal entries, etc.)
- **NO** "cleanup" scripts that delete test data via raw SQL
- **NO** backfill scripts that blindly assign orphaned records without proper tenant/company validation
- **ALLOWED:** SELECT queries for debugging/investigation only
- **ALLOWED:** Schema migrations via `db:push` (structure changes, not data changes)
- **ALLOWED:** system_config table operations via admin UI
- **If test data needs cleanup** → use the application's delete API endpoints, or build an admin tool if one doesn't exist yet

**Checklist before any data operation:**
- [ ] Am I using an API endpoint, not raw SQL?
- [ ] Does this operation write to activity_logs?
- [ ] Does this respect tenant isolation (tenantId filter)?
- [ ] If deleting, are there dependent records that would become orphaned?

#### Rule 6: Database JOIN vs Hard-Code Trade-off (SA Decision Framework)
**WHY this rule exists:** When business requirements have clear hierarchy and relationships (e.g., multi-tier users, tenant→company→employee), SA must decide whether to use database JOIN capabilities or handle relationships in application code. Neither approach is free — each has trade-offs.

**Use database JOINs when:**
- The relationship is straightforward (e.g., employee belongs to company, company belongs to tenant)
- Tables are small-to-medium and won't grow unbounded
- The alternative is complex manual code that risks bugs and orphaned data
- **Benefits:** Fewer lines of code, lower risk of wrong/flawed manual coding, database enforces referential integrity

**Avoid JOINs (use application code) when:**
- The SELECT table has potential to grow very large over time (e.g., transaction logs, order history with millions of rows) — JOINs on large tables hurt response time
- The relationship is very complicated (many-to-many with conditions, cross-database) — complex JOINs consume more processing power even on small data
- **Trade-off:** More code to maintain, higher risk of manual coding errors, but better control over performance

**Decision checklist:**
- [ ] Will this table grow to millions of rows? → Avoid JOIN, paginate + filter in app code
- [ ] Is the relationship simple parent→child? → Use JOIN, let the database handle it
- [ ] Am I writing 20+ lines of manual lookup code? → Consider if a JOIN would be simpler and safer
- [ ] Is response time critical for this endpoint? → Benchmark with JOIN vs without

**Remember:** You always trade the positive (less code, less risk) against the negative (database processing power). SA evaluates this balance for each case.

#### Rule 7: AI Kill-Switch Comments (MANDATORY for all AI code)
Every block of code that calls an external AI API MUST be marked with a `⚠️ AI` comment block so a human programmer can find and disable it without AI assistance. Use `grep -r "⚠️ AI" .` to find all AI-related code.

**Comment markers used in this codebase:**
- `⚠️ AI DEPENDENCY` — where the OpenAI SDK is imported/initialized (set `openai = null` to kill)
- `⚠️ AI API CALL` / `⚠️ AI API ENDPOINT` — the function/route that makes the actual API call
- `⚠️ AI TRIGGER` — the frontend function that initiates the call (e.g., `startAiExtract`)
- `⚠️ AI CALL BUTTON` — the JSX `<Button>` the user clicks (comment out to hide from UI)
- `⚠️ AI FEATURE LINK` — navigation button on list pages that leads to an AI feature page

**Current AI call locations (as of schema v84):**
| Feature | Frontend button | Backend endpoint | AI model |
|---|---|---|---|
| Purchase PDF Import (AI) | `purchase-pdf-import.tsx` | `server/routes/purchase-routes.ts` `/api/pdf-import/extract` | GPT-4o Vision |
| Expense PDF Import (AI) | `expense-pdf-import.tsx` | same endpoint | GPT-4o Vision |
| PDF Invoice Parse (No AI) | `purchase-invoice.tsx`, `expense-entry.tsx` | `/api/pdf-invoice-parse` | None (pdfjs-dist text extraction + pattern matching) |
| Slip Verification | `live-selling-routes.ts` | `server/routes/live-selling-routes.ts` | GPT-4o-mini Vision |

**To disable all AI globally:** Set `openai = null` in both `purchase-routes.ts` and `live-selling-routes.ts`. Frontend buttons become dead (API returns error), manual paths still work.

#### Rule 8: 3rd-Party Data Isolation (MANDATORY for all e-commerce integrations)
**WHY this rule exists:** If a 3rd-party API (Shopee/Lazada/TikTok) goes down or returns bad data, the main application must NOT be affected. Data from external platforms is untrusted until validated and batch-processed.

**Architecture:**
- **Staging DB on separate physical machine** — All data fetched from 3rd-party APIs (orders, settlements, products) is written to a **staging database** on a **different physical server**, never directly to the main production DB.
- **GET process (3rd party → Staging)** — Runs as a background worker/scheduler. If API fails, retries and self-recovers automatically. Manual trigger exists ONLY as emergency fallback when auto-recovery fails.
- **PUT process (Staging → Main DB)** — Runs 100% in background on production server. Validates data, deduplicates, matches SKUs, then writes to main DB in batch. No manual intervention in normal operation.
- **Isolation guarantee** — Main app queries ONLY from main DB tables. Never JOINs to staging. If staging server dies, main app continues working normally.

**Implementation pattern:**
- Staging connection: separate `DATABASE_URL_STAGING` on separate machine
- Main connection: `DATABASE_URL` on production machine
- Workers: scheduled background processes, not user-triggered
- Manual button: hidden/disabled by default, shown only in admin emergency panel

## User Preferences
- Multi-language account names: TH/EN/ZH — `useLanguage` hook + `acctName()` helper used across all account dropdowns, reports, journal forms. Language switcher in header (Globe icon) stores in `localStorage("app-language")`, dispatches `language-change` event. Hook: `client/src/hooks/use-language.ts`. Shared helper: `shared/i18n.ts` (`getAccountName()`). `useDocDropdowns` also exports `acctName` for document forms.
- **Full UI i18n System:** Translation files at `client/src/i18n/th.ts`, `en.ts`, `zh.ts` (简体中文), `zh-TW.ts` (繁體中文). 4 languages: `SupportedLanguage = "th" | "en" | "zh" | "zh-TW"`. Nested keys (nav, common, header, auth, hr, approval, toast). `useTranslation()` hook returns `{ t, lang }`. `translateLabel()` maps Thai nav labels → translation keys via `nav-map.ts`. Index at `client/src/i18n/index.ts` with `getTranslation()` fallback: target lang → Thai → raw key. For inline `lang` checks, use `lang.startsWith("zh")` to cover both zh and zh-TW. Pages translated: layout sidebar/header, login, 404, leave-management. Ongoing: more pages to translate.
- **LINE Notifications for Leave/OT:** `sendHrLineNotification()` in `server/routes/hr-routes.ts` sends LINE Flex Messages to admin/manager/owner/super_admin users with `lineId` when leave or OT requests are created. Blue header for leave, salmon header for OT. Company-level LINE token override supported.
- Thai language interface (ภาษาไทย)
- Flexy Vue3 color palette: Primary #fb9678 (salmon/orange) or #0085db (aqua/teal), Secondary #03c9d7 (cyan/teal), Warning/Yellow #fec90f (golden), Success #05b187 (green), Error #f94d4d (red), Info #539BFF (blue)
- **Theme Switcher:** Orange↔Aqua toggle via `useThemeColor` hook. CSS custom properties (`--theme-primary`, `--theme-primary-hover`, `--theme-primary-light`, `--theme-gradient-end`) control accent color. Preference stored in `localStorage("etax-theme-color")`. Toggle button (Palette icon) in layout header. Files: `client/src/hooks/use-theme-color.ts`, `client/src/index.css` (CSS vars in `:root`), `client/src/main.tsx` (init). Key files migrated from hardcoded #fb9678: layout.tsx, login.tsx, page-loader.tsx, date-picker.tsx, all flexy CSS utilities.
- **Dark Mode:** `ThemeMode = "light"|"dark"`, stored in `localStorage("etax-theme-mode")`. `useThemeColor()` hook returns `{ mode, isDark, toggleMode }`. Dark mode CSS variables defined in `.dark` class in `index.css`. **Global CSS overrides** at the end of `index.css` auto-remap all hardcoded Tailwind utility classes (`bg-white`, `text-gray-*`, `bg-gray-*`, `border-gray-*`, `bg-{color}-50/100`, hover/placeholder/ring variants) to dark-mode-appropriate values. These overrides are placed **outside `@layer`** to ensure they override Tailwind v4 utility specificity. Print media query neutralizes dark overrides for printing. When writing new pages, prefer semantic tokens (`bg-card`, `text-foreground`, `text-muted-foreground`, `bg-muted`, `border-border`) over hardcoded gray/white classes.
- Multi-tenant architecture with company switcher
- Prefers larger font sizes for readability (text-sm instead of text-xs in list pages)
- Color usage: Salmon for sidebar header/active menus, login header/button
- Outline buttons: Salmon border + salmon text (Outlined style from Flexy)
- Top header bar: Flexy-style "แอพ" (Apps) mega-menu dropdown replaces individual shortcut buttons. Permission-gated via `myPermissions.modules` (items without `module` prop always show). POS button kept visible outside. Quick Links sidebar in mega-menu. Responsive `w-[min(720px,calc(100vw-2rem))]`.
- Approval Center (ศูนย์อนุมัติ): `/approval-center` page aggregates all pending approvals — sales docs (QO/SO/IV/TIV/RC), purchase docs (PR/PO/AP/EXP), HR (leave/OT). API at `/api/approval-center` with tenant access control. Header icon `ClipboardCheck` with red badge count. Inline approve/reject buttons.
- Expand buttons per document type: QO=yellow, IV=green, TX=blue, RC=cyan (color-coded)
- Full-page forms preferred over popup dialogs for data entry
- Date format: DD/MM/YYYY พ.ศ. (Buddhist Era +543) throughout the system
- Journal books (สมุดบัญชี 5 เล่ม): general (ทั่วไป), receive (รับเงิน), payment (จ่ายเงิน), sales (ขาย), purchase (ซื้อ) - auto-assigned based on document type
- Chart of Accounts: Hierarchical 3-digit headers (บัญชีคุม) / 7-digit details (บัญชีย่อย) structure following TFRS. Headers are non-postable. Template defined in shared/chart-of-accounts.ts (STANDARD_CHART_OF_ACCOUNTS, ECOMMERCE_EXTRA_ACCOUNTS, ACCOUNTING_FIRM_EXTRA_ACCOUNTS). Old 4-digit code migration map removed — system uses 7-digit codes only.
- **PDF Invoice Parser** (`server/utils/pdf-invoice-parser.ts`): Parses e-commerce PDFs with platform-specific parsers (Shopee/SPX, TikTok, Lazada, Grab). Uses `INVOICE_PREFIX_MAP` for prefix-based auto-classification. Dispatch order: Shopee → TikTok Invoice → TikTok Receipt → Lazada → Grab → Template Engine → Generic.
  - **Known prefixes**: TRSPEMKP=Shopee Marketplace, TRSPESPF=ShopeeFood Commission, TRSPXADB=SPX Express Admin Fee, RCSPXSPR/RCSPXSPB=SPX Shipping, TTSTH=TikTok Tax Invoice, TTSTHCN=TikTok Credit Note, TTSTHAC=TikTok Affiliate, THJV=TikTok Logistics, THMPTI=Lazada Limited, THLPTI=Lazada Express, IM=Grab Service Fee
  - **Platform account codes**: 5241=Shopee Commission, 5242=Lazada, 5243=TikTok, 5244=Grab, 5245=ShopeeFood, 5251=Shopee Service, 5252=Lazada Service, 5253=TikTok Service, 5254=Grab Service, 5255=ShopeeFood Service, 5256=SPX Admin, 5265=SPX Shipping, 5266=Lazada Shipping, 5267=TikTok Shipping
  - **Formula mapping**: `PREFIX_FORMULA_MAP` in purchase-routes.ts maps invoice prefix → accounting formula businessType; `FORMULA_SUFFIX_MAP` creates distinct DXP journal numbers (SH/SPX/SHF/SPXA/LZ/LZX/TK/TKX/EC/GR/PF)
- **PDF Template Engine** (`server/utils/pdf-template-engine.ts`): Configurable template system for custom PDF parsing rules. Templates stored in `pdf_import_templates` table. Admin UI at /settings/import-templates.

## System Architecture

**Frontend:**
- **Technologies:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui.
- **UI/UX:** Responsive design adhering to Flexy Vue3 ORANGE_THEME, utilizing `flexy-card` and `flexy-icon-btn`.
- **State Management:** TanStack Query.
- **Routing:** `wouter`.

**Backend:**
- **Technologies:** Express.js.
- **Authentication:** Passport.js with `scrypt` for hashing.
- **API Design:** RESTful API with context-aware permissions (`requireModule()` middleware).
- **Permissions:** Granular role-based access control.
- **Auto Journal Entry:** Automated entries triggered by document approval, including withholding tax.
- **Route Modules:** Split into 79 domain-specific files under `server/routes/`. Shared middleware in `server/route-middleware.ts`, helpers in `server/route-helpers.ts`, route factory in `server/route-factory.ts`. Main `server/routes.ts` is 230 lines (imports + registration only). Route factory provides `createRouteGroup()` with `companyRoute()`, `paginatedRoute()`, `ownerRoute()` helpers that handle try/catch, auth, companyId extraction, and company access verification automatically.
- **Pagination:** All list endpoints use `parsePagination()` helper with backward-compatible response format. Default 50 rows/page, max 200.
- **Report Cache:** In-memory cache with 5-min TTL for financial reports (GL, trial balance, income statement, balance sheet). Auto-invalidated on journal entry create/update/delete.
- **Period Balance Summary:** `account_period_balances` table stores pre-aggregated Dr/Cr totals per account per month. Trial balance uses summary table when available (fast path: ~12 rows instead of millions). Auto-updated on journal entry create/update/delete. Manual rebuild via `POST /api/reports/rebuild-period-balances`. Status check via `GET /api/reports/period-balance-status`. Files: `server/routes/period-balances.ts`.
- **Performance Indexes:** Covering index on `journal_lines(journal_entry_id, account_id, debit, credit)` for Index-Only Scan. Composite index on `journal_entries(company_id, status, entry_date)`. Product-level index on `ecommerce_order_items(order_id, product_id)`. Campaign date index on `ad_spend_entries(campaign_id, spend_date)`.
- **Report Query Optimization:** All financial reports (GL, Trial Balance, Income Statement, Balance Sheet, Cash Flow, Compare reports, Financial Statements Package) use SQL `JOIN + GROUP BY + SUM()` aggregate queries via `server/report-queries.ts` helper functions instead of loading all journal entries/lines into memory. This supports 500K+ transactions/month per company without memory issues.

**Database:**
- **Type:** PostgreSQL.
- **ORM:** Drizzle ORM.
- **Schema:** Designed for users, companies, employees, financial documents, inventory, e-commerce entities, and accounting records.
- **Multi-language Support:** Fields for Thai, English, and Chinese names/addresses/account names.
- **Auto Schema Sync:** `server/db-schema-sync.ts` runs on every server startup (dev & production). Reads all 269+ table definitions from `shared/schema.ts` via Drizzle `getTableConfig()`, compares with actual DB tables, and auto-creates missing tables (with topological sort for FK dependencies) and missing columns. Prevents deploy-time errors when new features add schema tables. Logs all changes as `[schema-sync]`. **IMPORTANT:** `drizzle-kit push --force` has been DISABLED from auto-startup to prevent data loss (it could DROP and recreate tables). Only `db-schema-sync.ts` (safe CREATE/ALTER only) is used for auto-sync. Use `npm run db:push` MANUALLY only when absolutely needed and with data backup.

**Core Features:**
- **E-commerce Hub:** Integrates with multiple platforms for order management, SKU mapping, and stock synchronization. Supports Excel/CSV import and API integrations.
- **Analytics Dashboard:** Provides cross-platform sales analytics, KPIs, and trend analysis.
- **Multi-Warehouse & Delivery Hub:** Manages stock levels, transfers, pick-pack-ship processes, parcel label printing, tracking, and LINE notifications.
- **Auto Order Sync:** Manages platform OAuth connections and synchronization processes.
- **Unified Chat Inbox & Facebook Chat Orders:** Centralized chat and AI-powered parsing of "CF" messages with slip verification.
- **Live Selling Module:** Manages live sessions, order capture, and includes a Lucky Draw feature.
- **Multi-currency Support:** Tracks 12 currencies across sales documents.
- **Document Management:** Live preview of Thai tax invoices with flexible templates.
- **Multi-Prefix System:** Each document type supports multiple prefix options (e.g., TIV, TAX for tax invoices). Settings UI in document-templates.tsx allows add/remove/set-default. Forms dynamically show prefix dropdown from `docPrefixes` JSON in `document_settings`. `use-prefix-options.ts` hook shared across 10 document forms. Data format: `{docTypeKey: {options: ["A","B"], default: "A"}}`. Backward compatible with old `{key: "single"}` format.
- **Product Management:** Supports VAT types, product types (simple/bundle/manufactured), Bill of Materials (BOM), and multi-level pricing (retail, wholesale, agent, special, VIP).
- **Promotions System:** Rule-based promotion engine.
- **HR & Attendance:** Employee tracking, overtime calculation, payroll, payslip generation, and Thai tax document generation (ภงด.1, ภงด.1ก, 50 ทวิ). Attendance report checks holidays + work_schedules (no false absents on days off). OT auto-calculation: weekend/holiday OT splits into regular-hours (1x) and overtime (3x) portions via `/api/ot/calculate` endpoint. Default ot_settings: regular (1.5x), holiday_regular (1x), holiday (3x), special_holiday (3x). Attendance records track `source` field (manual/gps/scanner/webhook).
- **Shift Management:** Multi-shift support (morning/afternoon/night shifts). Admin creates shifts with custom times, break periods, late thresholds, and color badges. Employees can be assigned to shifts per day via a weekly/monthly calendar view. Check-in/check-out uses employee's assigned shift timing (falls back to default work_schedule if no shift assigned). Attendance report shows shift name per record. Copy-previous-week feature for quick scheduling. Tables: `shifts` (shift definitions), `employee_shift_assignments` (employee-date-shift mapping). UI pages: `/hr/shift-settings` (CRUD shifts), `/hr/shift-schedule` (calendar assignment view).
- **Fingerprint Scanner Integration:** Import attendance data from fingerprint scanners (ZKTeco, HikVision etc.) via CSV/Excel/DAT file upload or real-time webhook. Tables: `scanner_employee_mappings` (maps scanner employee codes to system employees per device), `scanner_import_logs` (tracks import history). UI pages: `/hr/scanner-mapping` (CRUD mapping between scanner codes and employees), `/hr/scanner-import` (upload file, preview with match/unmatch summary, confirm import). Webhook endpoint: `POST /api/scanner-webhook` (token-based auth via `SCANNER_WEBHOOK_TOKEN` env var, `x-webhook-token` header). Import confirm re-parses file server-side for security (no client-sent employee IDs). All scanner APIs enforce company-scoped access from authenticated user context.
- **WHT Import Tool (นำเข้า 50 ทวิ / ภงด.1ก):** Standalone client-side tool at `/hr/wht-import` for importing external Excel data to generate 50 ทวิ certificates and ภงด.1ก CSV/Excel for RD e-Filing. Separate from payroll module — no backend storage, pure client-side processing. Supports template download, preview/print individual or all 50 ทวิ, and RD-compliant CSV export.
- **In-app Support Chat & Notification Center:** For communication and alerts.
- **Internal Chat (แชทภายใน):** Organization-wide messaging with direct and group chat, unread counts, member management. Advanced features: Reply/Quote (replyToId + quoted preview), Emoji Reactions (toggle, 6 quick-reactions bar), Pin Messages (toggle + pinned panel), File/Image Sharing (upload via Object Storage, image preview + file download), Message Search (ilike full-text search within room), Forward Messages (cross-room forwarding with forwardedFromId/forwardedFromRoomName), Edit/Delete Messages (editedAt timestamp, soft-delete via deletedAt, 15-min edit window, sender-only), Typing Indicator (in-memory Map with 3s auto-expiry), @Mention with Autocomplete (parses @username, keyboard nav, highlighted rendering). Tables: `internal_chat_rooms`, `internal_chat_members`, `internal_chat_messages` (columns: replyToId, pinnedAt, pinnedBy, attachmentUrl, attachmentName, editedAt, deletedAt, forwardedFromId, forwardedFromRoomName), `internal_chat_reactions` (messageId, userId, emoji, unique constraint). Routes: `/office/chat`. Backend: `server/routes/internal-chat.ts`.
- **Video Call 1:1 (WebRTC):** Peer-to-peer video calls between direct chat users. WebRTC with Google STUN servers. Signaling via polling (in-memory call store with 5-min auto-cleanup). Features: local PiP video, remote full-screen, mute/camera toggle, call duration timer. Incoming call overlay with ring animation. All call endpoints enforce caller/callee identity check. Component: `client/src/components/video-call.tsx`.
- **Group Video Call (WebRTC Mesh):** Group video calls for group chat rooms (max 4 participants). Mesh topology — each participant creates RTCPeerConnection with every other. In-memory group call store with 30-min auto-cleanup. Features: 2x2 grid layout, join/leave, mute/camera toggle, active call banner with "เข้าร่วม" button, participant counter. Signaling via polling per-pair (offer/answer/ICE). Endpoints: `/api/internal-chat/group-calls/*` (start, join, signal, signals, leave, room/:roomId). Component: `GroupVideoCall` in `client/src/components/video-call.tsx`.
- **Meeting Room (ห้องประชุม):** Schedule meetings with Google Meet/Zoom/other links. CRUD with participant management (invite/accept/decline). Tenant-scoped participant validation. Filter tabs: upcoming/past/my meetings. Quick-create from chat room. Tables: `meetings`, `meeting_participants`. Routes: `/office/meetings`. Backend: `server/routes/meetings.ts`.
- **Full Calendar (ปฏิทิน):** Flexy-style calendar with month/week/day views, colored events, categories (general/meeting/deadline/holiday/tax/live), CRUD operations. Integrates HR holidays (red, non-editable) and RD tax deadlines (purple=filing, blue=e-filing, non-editable). Table: `calendar_events`. Routes: `/office/calendar`. Backend: `server/routes/calendar-events.ts`, `server/routes/tax-calendar.ts`. Tax deadlines use standard Thai filing schedule with weekend adjustment + optional scrape from rd.go.th.
- **Payment Methods:** Configurable and linked to the chart of accounts.
- **Tax Invoice Print Options:** Supports four distinct types.
- **Custom Form Print Templates:** Allows creating print templates that align data output with pre-printed paper forms. Users upload a scan of their blank form as background, then position data fields (header, items table, totals) to match exact paper positions. Supports per-company, per-document-type templates with mm-precision field positioning. Table: `custom_form_templates`. Settings page: `/settings/custom-forms`.
- **AR/AP Aging Reports & Profit Per Order:** For financial tracking.
- **Excel Export on List Pages:** All 11 sales/purchase list pages have Excel export button + branch filter. Uses reusable `ListExportButton` component (`client/src/components/list-export-button.tsx`) with SheetJS.
- **Invoice Excel Import:** 3-step flow (upload → preview → create) at `/sales/invoice/import`. Backend: `/api/invoices/import/template` (download), `/api/invoices/import/preview` (parse+validate), `/api/invoices/import/create` (bulk create with auto-journal). Supports CSV/XLSX, multi-line docs (same doc# = one invoice), customer/product auto-match, duplicate detection, server-side total recomputation, tenant isolation. Page: `client/src/pages/sales/invoice-import.tsx`.
- **Sales Report (รายงานยอดขาย):** At `/reports/sales`. Groups by employee/product/customer/branch across quotations, sales orders, invoices, tax invoices. Backend: `/api/reports/sales-summary`.
- **Gross Profit Report (กำไรขั้นต้น):** At `/reports/gross-profit`. Shows per-document profit from tax invoices and invoices. Backend: `/api/reports/gross-profit`.
- **Low Stock Alerts & Returns/Refunds:** Inventory and returns management.
- **LINE Tracking Notifications & Group Document Auto-Save:** Automated notifications and document archiving from LINE groups.
- **LINE Tax Reminder:** Automated LINE Flex Messages to client groups before tax deadlines. Configurable days-before, optional stickers, scheduler runs hourly (8-10 AM Thai time). Settings page at `/settings/tax-reminder`. Tables: `tax_reminder_settings`, `tax_reminder_logs`. Service: `server/services/tax-reminder.ts`.
- **Per-Company LINE Token:** Each company can configure its own LINE Channel Access Token via Settings → LINE. Falls back to platform-level token if not set. Settings page at `/settings/line`.
- **LINE Document Auto-Receive Settings:** Full settings UI at `/settings/line` with 4 tabs: API Token (token/secret/LINE ID config), กลุ่ม LINE (group mapping CRUD with pending group claim, default document type per group), จัดประเภทอัตโนมัติ (auto-classify rules: condition-based document categorization), Webhook (URL display, copy, connection test with bot/group/doc stats). Tables: `line_group_mappings` (with `default_document_type`), `line_doc_classify_rules`. APIs: `/api/line-documents/classify-rules` (CRUD), `/api/line/webhook-test`.
- **Auto-TIV on Ship & Tax Invoice Reconciliation:** Automates tax invoice generation and reconciles e-commerce orders. VAT-aware: respects company VAT registration status, supports mixed VAT items (7%+0%).
- **VAT Product Dictionary:** AI-powered product VAT classification system. Learns from accountant confirmations. Excel import shows AI-suggested vatType popup for review. API sync auto-applies dictionary entries. Table: `vat_product_dictionary`.
- **E-Commerce Team Management:** Per-module team management with role-based access (manager/operator/viewer), granular permission control (orders, fulfillment, inventory, returns, analytics, settlements, settings), store assignment, and cross-link to central user management. Table: `ecommerce_team_members` with unique `(company_id, user_id)` constraint.
- **Module-Based Pricing:** Per-module subscription system. Tables: `module_plans` (module_key + tier pricing), `tenant_module_subscriptions` (per-tenant per-module subscriptions with trial/active/expired status). 7 modules (accounting, hr, ecommerce, pos, restaurant, firm-mgmt, warehouse) each with 2-3 tiers (free/starter/pro). UI at `/settings/module-pricing` with "โมดูลของฉัน" dashboard and "แพ็คเกจทั้งหมด" pricing grid. Monthly/yearly toggle with 17% savings. APIs: `GET /api/module-plans`, `GET /api/my-modules`, `POST /api/my-modules/subscribe`.
- **E-Commerce Settlement & Wallet Tracking:** Imports settlement reports, tracks wallet balances, and automates journal entries.
- **Platform Fee Config & Price Calculator:** Configurable fee rate profiles per platform (commission/service/payment/other %), calculates recommended selling prices from cost + desired profit, bulk comparison across platforms with price diff indicators. Table: `platform_fee_configs`. Route file: `server/routes/price-calculator.ts`.
- **Bulk Operations:** For batch updates and printing of e-commerce orders. Order import supports up to 50,000 rows/file with chunked processing (500 orders/chunk), auto-creates TIV + journal entries + stock movements per order. Settlement import for receipt/payment tracking.
- **Financial Statements:** Cash Flow, Comparative Income Statement, and Balance Sheet.
- **Financial Ratios Dashboard:** Comprehensive financial ratio analysis with 4 categories (Liquidity, Leverage, Profitability, Efficiency), Health Score gauge (0-100), DSO/DPO/DIO KPIs, 12-month trend charts, industry benchmarks (SME/Manufacturing/Service/Retail), and AI recommendations. Route: `/reports/financial-ratios`. Backend: `server/routes/financial-ratios.ts`. Frontend: `client/src/pages/reports/financial-ratios.tsx`.
- **Cash Flow Forecast & Working Capital Monitor:** 30/60/90-day cash projection from AR/AP aging with best/expected/worst case scenarios. Working Capital dashboard with current assets vs liabilities bar chart, WC ratio 12-month trend, Net Working Capital, Cash Conversion Cycle (DIO+DSO-DPO). Alert threshold for low cash projection. Excel export. Route: `/finance/cash-flow-forecast`, API: `/api/finance/cash-flow-forecast`, Backend: `server/routes/cash-flow-forecast.ts`.
- **General Reports Hub:** Central navigation for all reports.
- **Financial Analytics Suite:** OPEX/CAPEX Analysis (stacked bar + pie charts), Growth Trend Analysis (multi-line chart by quarter/year), Department P&L (matrix table by cost center), Break-Even Calculator (BEP units/value with chart). Backend: `server/routes/financial-analytics.ts`. Frontend: `client/src/pages/reports/opex-capex.tsx`, `growth-trend.tsx`, `department-pl.tsx`, `break-even.tsx`.
- **Financial Management Dashboard:** CFO-level control panel showing 5 sections: (1) Top Metrics — Cash Position, Net Profit, EBITDA with 6-month trend sparklines, (2) Financial Position — Revenue, Expenses, AR, AP, Book Balance, (3) CFO Metrics — ROA, OPEX Ratio, CAPEX, Break-Even Revenue, (4) Business Health Indicators — Profitability, Liquidity, Cost Discipline, Growth Readiness with 4-level status, (5) Financial Buffer — user-defined targets for Survival/Development/Expansion/Protection buffers with progress bars. Period selector: month/quarter/year/compare-last-year. Data sourced from actual accounting entries. Table: `financial_buffers`. Backend: `server/routes/financial-management.ts`. Frontend: `client/src/pages/reports/financial-management.tsx`.
- **Enhanced Expense Entry:** Dynamic line items with per-line VAT/WHT calculation.
- **Non-Deductible Input VAT (ภาษีซื้อต้องห้าม):** Per Thai Revenue Code Section 82/5, certain expenses (vehicle-related, food & beverages) cannot claim input VAT. The system supports `vatType: "vat_non_deductible"` on expense/purchase items. When selected: (1) VAT is merged into expense amount in journal entries (no input VAT line), (2) Purchase tax report excludes non-deductible items, (3) `showInTaxReport` auto-sets to false when all items are non-deductible.
- **ภ.พ.30 VAT Summary Report & Purchase Tax Report:** For VAT and purchase invoice reporting.
- **RD Direct Tax File Export:** Export pipe-delimited .txt files in TIS-620 encoding for direct upload to RD Direct (rdirect.rd.go.th). Supports 4 forms: ภ.พ.30, ภ.ง.ด.3, ภ.ง.ด.53, ภ.พ.36. Backend routes in `server/routes/rd-direct-routes.ts`, TIS-620 utility in `server/utils/tis620.ts`. Frontend buttons in VAT PP30 report and WHT report pages.
- **Bank Reconciliation:** Imports statements and matches journal entries.
- **Activity Log:** Audit trail of system activities.
- **System Flowchart (Software House):** `/system-info` page for Thai Revenue Department Software House ID registration (คำสั่ง ท.643/2556). Shows interactive SVG system flowchart (ข้อ 2.1) + subsystem detail cards (ข้อ 2.2) + software info. Print/PDF button for formal submission. Pure SVG text rendering for PDF compatibility. Nav item under settings section.
- **Excel Export:** For e-commerce orders, returns, and activity log.
- **VAT Closing Warning System:** Alerts users when saving documents for closed VAT periods.
- **POS Module:** Manages sales sessions, product grids, multiple payment methods, and auto journal entries. Includes customer search, discounts, hold/park orders, cash reconciliation, barcode scanning, PromptPay QR Code payment, and Bluetooth thermal receipt printing (ESC/POS). **Multi-branch POS**: Sessions link to `storeId` (branches table) and `warehouseId`. Auto-creates warehouse per branch. Stock deducted from branch warehouse on sale. Branch selector dropdown in open-session dialog. API: `/api/pos/branches` (GET/POST), `/api/pos/warehouse-stock` (GET). **POS Journal at Session Close**: Journal entry deferred from per-transaction to session close — creates 1 summarized journal entry per session. Mixed payment methods produce split debit lines by payment method account code via `overrideLines`. **POS Real-time Dashboard** (`/pos/dashboard`): Executive view with branch-level sales breakdown, hourly chart, payment method stats, auto-refresh every 30s. API: `GET /api/pos/dashboard`. Filters by transaction `createdAt` (not session `openedAt`) for accuracy. **Full Tax Invoice from POS**: Checkout dialog has "ออกใบกำกับภาษีเต็มรูป" toggle with customer name, tax ID, address, phone, email fields. Auto-fills from loyalty member data. Backend validates name+taxId required when `fullTaxInvoice=true`. Writes to `taxInvoices.customerAddress`, `customerTaxId`, `contactPhone`, `contactEmail`. `loyalty_members` table has `address` and `tax_id` columns. **POS Staff Management** (`/pos/staff`): CRUD for POS users with `allowedBranchIds` (integer array on users table). Roles: staff/branch_manager/cashier. Excel bulk import. Staff see only assigned branches. **POS Commission System** (`/pos/commission`): 3 commission types — percentage of revenue, per-piece rate, tiered (stepped). Commission rules apply to cashier, recommender, or both. CRUD API at `/api/pos/commission-rules`. Calculation API at `/api/pos/commission/calculate` joins posTransactions→posSessions to attribute sales to users.
- **Stock Transfer GPS Tracking & Delivery Signature:** Enhanced stock transfer flow: Draft → Approved (stock deducted) → Shipped (GPS lat/lng recorded) → Delivered (GPS + digital signature + receiver name). Schema: `shipGpsLat/Lng`, `receiveGpsLat/Lng`, `receiverSignature` (base64 PNG), `receiverName`, `shippedBy/At`, `receivedBy/At`. Frontend: Canvas-based signature pad, browser Geolocation API, Google Maps links. Detail dialog shows GPS coordinates, signature image. All endpoints company-scoped for authorization.
- **Bluetooth Thermal Printer:** Web Bluetooth API for Android/Windows/macOS Chrome direct ESC/POS printing to 58mm/80mm thermal printers. iOS falls back to browser print dialog. Library: `client/src/lib/thermal-printer.ts`. Thai text via TIS-620 encoding. Settings saved to localStorage. Integrated in POS terminal (auto-print on sale) and receipt page (manual print).
- **Delivery Notes (ใบส่งของ):** Create delivery notes from QO, IV, or standalone (no customer required). GPS location, driver assignment, public signing link for customer signature on mobile. Tables: `delivery_notes`, `delivery_note_items`. Routes: `server/routes/delivery-note-routes.ts`. Pages: `delivery-notes.tsx`, `delivery-note-form.tsx`, `delivery-sign-public.tsx`. Public URL: `/delivery-sign/:token`.
- **Store Clone:** Clones products across e-commerce stores/platforms.
- **Barcode Auto-Generation & Label Printing:** Generates EAN-13 barcodes and prints labels.
- **Product Lot/Batch Tracking:** Tracks manufacturing lots with expiry dates. Products can enable `trackLots` flag (checkbox in product form). GR form conditionally captures lot number, manufacturing date, expiry date per tracked-product item. `product_lots` table tracks quantity per lot. Lot management page at `/inventory/lots` with "All Lots" and "Expiring" tabs, color-coded expiry alerts (red ≤0d, amber ≤7d, yellow ≤30d, green >30d), inline editing, FEFO sort order (earliest expiry first). PATCH/DELETE endpoints enforce companyId scoping.
- **Manufacturing Orders (ใบสั่งผลิต):** Full production management linked with BOM and lot tracking. Tables: `manufacturing_orders`, `manufacturing_order_lines`. Routes in `server/routes/manufacturing-routes.ts`. Statuses: draft → in_progress → completed. On completion: auto-creates lot for finished product, deducts raw materials by FEFO (earliest expiry lot first), creates stock movements (`production` for finished goods, `mo_consume` for materials), updates product_stock. Frontend: list at `/inventory/manufacturing`, form at `/inventory/manufacturing/form/:id`. Stock card shows MO reference links.
- **Asset Installment/Leasing (ผ่อนชำระทรัพย์สิน):** Comprehensive HP/leasing contract management. Supports 4 VAT scenarios: HP reclaimable, HP non-reclaimable (passenger car), Leasing reclaimable, Leasing non-reclaimable. Auto-generates amortization schedules (flat rate), opening journal entries, and per-installment payment journals. Tables: `asset_installment_contracts`, `asset_installment_schedules`. Route: `/assets/installments`.
- **Employee Birthday Celebration:** `dateOfBirth` field on employees. When an employee checks in on their birthday, a popup with confetti animation and Happy Birthday music plays. Birthday check endpoint (`/api/attendance/birthday-check/:employeeId`) scoped by tenant for security.
- **Work Anniversary Celebration:** When an employee checks in on the anniversary of their `startDate`, a congratulatory popup shows with star sparkle animation, displaying how many years they've been with the firm. Messages vary by milestone (1yr, 3yr, 5yr, 10yr+). Endpoint: `/api/attendance/anniversary-check/:employeeId`. If both birthday and anniversary fall on the same day, anniversary popup shows after a delay.
- **Employee Self-Service (ESS) Portal:** Employee-facing dashboard for profile, leave/OT requests, and document downloads. Leave balance summary shows quota, carry-over, used, remaining per leave type.
- **Leave Policy & Carry-over System:** `leave_policies` table (companyId, leaveType, annualQuota, carryOverEnabled, maxCarryOverDays, carryOverExpiryMonth, carryOverExpiryDay). `leave_balances` table (employeeId, year, leaveType, quota, carriedOver, used, expired, carryOverExpiryDate). Admin UI at `/hr/leave-policy` for CRUD and year-end carry-over processing. ESS dashboard shows dynamic balance with carry-over details. LINE webhook uses dynamic policies instead of hardcoded quotas. API: GET/POST/PATCH/DELETE `/api/leave-policies`, GET `/api/leave-balances`, GET `/api/leave-balances/summary`, POST `/api/leave-balances/carry-over`, GET `/api/ess/leave-balance-summary`.
- **Online Contract Signing:** Creates Thai accounting service contracts, captures signatures, and tracks status.
- **Work Management:** Monday.com-style board system with customizable columns, inline editing, and "Last updated" tracking (relative time + updater avatar per item).
- **E-Tax Hub:** Monday.com-style work management for accounting firms. Boards (boardType="etax-hub") with groups, items (clients), subitems (tasks like ภพ.30, statement), and customizable columns (status/person/date/text). API routes in `server/routes/etax-hub.ts`. Frontend: `client/src/pages/etax-hub/dashboard.tsx` (KPI dashboard), `client/src/pages/etax-hub/client-board.tsx` (board UI). All endpoints use `requireModule("etax-hub")` + role-based access control. Board sharing for external guests via share links.
- **Board ↔ Assignments Two-Way Sync:** Person column in eTax Hub boards syncs with `firm_clients.assigned_to`. Changing assignedTo via PATCH `/api/firm-clients/:id` updates board items (routes.ts). Changing person column in board updates firm_clients (etax-hub.ts board item PATCH, uses firmClientId first, fallback to name). Backfill API: `POST /api/etax-hub/boards/:id/sync-assignments` maps nicknames→employee IDs, normalizes board values, links `firm_client_id`, updates `firm_clients.assigned_to`. UI button: "Sync ผู้รับผิดชอบ → มอบหมายงาน" in board dropdown menu.
- **4-Way Auto-Sync on New Client:** When POST `/api/firm-clients` creates a new client, it auto-creates: 1) company, 2) contact in firm's primary company, 3) firm_client record, 4) board items in all tenant eTax Hub boards (with person+taxId columns populated, firmClientId linked). Duplicate check by name prevents re-adding existing items.
- **Board-Level Permissions:** `work_board_members` table stores per-board user roles (owner/editor/viewer). Owner = full control + manage members, Editor = add/edit/delete items, Viewer = read-only. `checkBoardAccess()` enforces role thresholds on all data/mutation endpoints. Board creators auto-assigned owner role. Boards with no members allow all company users (backward compat). Members dialog accessible via "สิทธิ์" button in board header.
- **Saved Views (แท็ปส่วนตัว):** `work_board_views` table stores per-user saved filter views. Each view has name + JSON filters (personFilter, statusFilter). Displayed as tabs next to "Main table". Users can save current filters as a view, rename (double-click), delete (hover X). Person filter picker in toolbar dropdown.
- **ปฏิทินของฉัน (My Calendar):** `/etax-hub/calendar` page. Aggregates items from all boards where user is assigned (Person column = userId). Shows monthly calendar grid with events color-coded by board. Sidebar menu item "ปฏิทินของฉัน". API: `GET /api/etax-hub/my-calendar?month=&year=&companyId=`.
- **White Label:** Tenant-level branding customization.
- **Document Repository (คลังเอกสาร):** Categorized storage for important documents with file management and links.
- **Client Upload Links & Unified Document Repository:** Token-based public upload links for clients to send documents without login. Tables: `client_upload_links`, `client_upload_files`, `line_documents`. Public page at `/upload/:token`. Management in "เอกสารลูกค้า" tab of คลังเอกสาร page with **monthly folder** view (left panel) and **3 source tabs** (right panel: จากลิงก์/จาก LINE/พนักงานอัปโหลด). LINE documents grouped by `created_at` month. APIs: `/api/client-documents/monthly-summary`, `/api/client-documents/month-files`, `/api/client-documents/month-links`. Routes in `server/routes/etax-hub.ts`.
- **POS ร้านอาหาร (Restaurant POS):** Manages tables, orders, kitchen display, menu categories, modifiers, split bills, and service charges.
- **Accounting Management Tools (เครื่องมือจัดการบัญชี):** Eleven accounting tools for financial data management with preview/execute patterns and audit logs. Includes "นำเข้างบทดลองเปรียบเทียบ" — client-side tool to import 2 years of trial balance from Excel and generate comparative Income Statement + Balance Sheet without journal entries (temporary, no DB storage).
- **Warehouse Bin Location System:** Hierarchical zone/aisle/shelf/bin management with visual warehouse map.
- **Wave/Batch Picking:** Wave creation, picker assignment, item-by-item pick tracking with optimized walking paths.
- **PDA Mobile Interface:** Mobile-first warehouse interface with Receive, Put Away, Picking, and Cycle Count modes.
- **Real-time Stock Sync:** Multi-platform stock synchronization with manual/auto/realtime modes.
- **Supplier Portal:** Token-based external supplier access for POs and quotes.
- **Chat Auto-Reply Rules:** Keyword/trigger-based auto-reply rules with review and testing features.
- **Chat Orders (LINE + Facebook + Instagram):** Automatic order detection from LINE OA, Facebook Messenger, and Instagram DM chats using regex-based CF pattern matching. Messages stored in Unified Chat Inbox, orders auto-detected and shown with green badges. Confirm/cancel flow creates `ecommerce_orders`. Tables: `chat_orders`, `chat_order_keywords`. Webhook endpoints: `POST /api/line/webhook` (enhanced), `POST /api/facebook/webhook` (handles both FB + IG via Meta platform). Default keywords: CF, cf, สั่ง, order. Keyword settings page: `/ecommerce/chat/keywords`.
- **AI Analytics & Demand Forecasting:** Moving average/exponential smoothing forecasts, top product analysis, and restock urgency suggestions.
- **AI Live Commerce Agency:** AIDA framework-based live selling management for agencies, including client management, real-time session monitoring, performance metrics, AI-powered product sequencing, ad budget optimization, and post-live reports.
- **Job Costing (ต้นทุนงานก่อสร้าง):** Track construction project costs and profit/loss. Supports project types (construction, condo, housing, renovation, infrastructure), unit management (rooms/houses/lots with area and selling price), cost allocation by category (material, labor, subcontract, equipment, overhead), shared cost distribution by area ratio, and per-unit profitability reports. Tables: `construction_projects`, `project_units`, `project_cost_allocations`. Module key: `job-costing`. Routes: `server/routes/job-costing-routes.ts`. Pages: `client/src/pages/job-costing/`.
- **Commerce Intelligence Module:** Profit-Centered Commerce Intelligence System with 5 dashboards: Executive (KPIs, trends, alerts), Channel (platform comparison, growth analysis), Product & Profit (per-SKU profitability, hero product identification), Campaign (ROAS vs profit analysis, budget recommendations), Live Commerce (session analytics, host comparison, time slot heatmap). Backend routes in `server/routes/commerce-intelligence.ts`. Frontend pages in `client/src/pages/commerce-intelligence/`. Permission key: `commerce-intelligence`.
- **Seller Branch (สาขาผู้ออกเอกสาร):** `sellerBranchId` field on all 16 document tables (sales + purchases). Dropdown selector in all 14 document forms populated from `branches` table. DocumentRenderer auto-fetches branch address via `/api/branches` when `sellerBranchId` is present. Tax reports (sales/purchase) support `sellerBranch` query filter. Branch field in documents = customer's branch (text); sellerBranchId = company's issuing branch (select).
- **Commission System (Dual Module):** `commission_rules` table with `module` field (`pos` or `accounting`) for isolated rule sets. `docTypes` array field on rules for filtering which document types count. POS commission: `/api/pos/commission-rules` + `/api/pos/commission/calculate` — aggregates posTransactions→posSessions. Accounting commission (`/sales/commission`): `/api/accounting/commission-rules` + `/api/accounting/commission/calculate` — aggregates approved tax invoices (taxInvoiceDate), invoices (invoiceDate), receipts (receiptDate) by `salesperson` field. Supports % / per-bill / tiered types. Per-rule docType filtering ensures each rule only counts its specified document types. Company ownership verified on all CRUD. Module boundary enforced (POS can't modify accounting rules and vice versa). Sidebar: การขาย → คอมมิชชั่นเซลส์.
- **Budget vs Actual System:** `budgets` table (companyId, accountCode, accountName, accountType, year, month, amount, version). Budget Entry page (`/reports/budget-entry`) provides spreadsheet-like interface for setting monthly budgets by account with copy-from-previous-year with % adjustment. Budget vs Actual report (`/reports/budget-vs-actual`) compares budget amounts vs actual GL balances with grouped bar charts (by account and by month), variance highlights (green=under budget, red=over budget), alerts at >80% and >100% usage, and Excel export. Backend routes in `server/routes/budget-routes.ts`. Both pages accessible from Management Reports section in General Reports page.
- **Management Reports (รายงานสำหรับฝ่ายบริหาร):** 13 report variants under General Reports → Management section: BL1 (balance sheet compare %), BL2 (balance sheet compare amounts), BL3 (balance sheet 12-month line chart), PL1 (P&L compare %), PL2 (P&L compare amounts), PL3 (P&L 12-month table with per-account detail), PL4 (P&L 12-month bar/line chart), PL5 (P&L cumulative area chart), M2 (P&L month vs year), M3 (P&L compare with original change%), M4 (P&L quarterly with bar chart). Backend APIs: `/api/reports/income-statement-monthly` and `/api/reports/balance-sheet-monthly` return 12-month breakdowns with account-level detail. All reports support Excel export and print.

**FTP Archive Config (Core Infrastructure):**
- FTP credentials and all archive settings stored in `system_config` table (NOT in `ftp_archive_settings`).
- Keys: `FTP_HOST`, `FTP_PORT`, `FTP_USER`, `FTP_PASSWORD`, `FTP_PROTOCOL`, `FTP_REMOTE_PATH`, `FTP_BASE_URL`, `FTP_LAN_BASE_URL`, `FTP_PASSIVE`, `FTP_RESUME_ENABLED`, `FTP_SCHEDULE_TIME_1/2`, `FTP_TIMEZONE`, `FTP_FILE_AGE_MONTHS`, `FTP_ALERT_AFTER_DAYS`, `FTP_ALERT_LINE_RECIPIENT_ID`, `FTP_ENABLED`, `FTP_TEST_MODE`.
- `system_config` is excluded from clone operations — FTP config stays per-deployment, not cloned with business data.
- `getArchiveSettings()` in `server/services/ftp-archive.ts` builds `FtpArchiveSettings` object from `system_config` via `getConfig()`.
- `upsertArchiveSettings()` writes back to `system_config` via `setConfig()`.
- Production server: `tax-gateway.hopto.org`, folder `/fa` (shortened from `/app_attachment` to save 12 chars on NTFS paths).
- **FTP Archive Server Status:** Currently **OFFLINE** (was used for testing file naming rules only).
- **⚠️ MACHINES TABLE + FTP ARCHIVE — NOTE ONLY, DO NOT TOUCH CODE:** When FTP server comes back online, it will need a record in `machines` table with `serverType = "ftp_server"` (which doesn't exist yet), plus connection info, upload path, etc. This is **dangerous and complicated work** — Kai must ONLY do this together with พี่ช้าง. Never modify `machines` table schema or FTP archive source code independently. This note is a reminder for future planning sessions only.
- **General upload path:** Always `{cwd}/uploads` via `path.join(process.cwd(), "uploads")`. Simple, portable across Linux/Windows. Do not change this.

**FTP Archive Folder System:**
- Utilizes `company_folder_codes` (C + 5 digits) and `store_folder_codes` (S + 3 digits) for immutable folder structures.
- Archive path: `{ftpRoot}/C00042/2026-02/{sanitized_filename}` for company-level docs and `{ftpRoot}/C00042/S026/2026-02/{filename}` for store-level docs.
- A "Dirty Flag" system ensures directory indexes (JSON and TXT) are updated on FTP for changes in company/store details.
- Backfill functionality for generating codes for existing entities.
- NTFS safety measures include path validation and safe filename handling using `server/utils/safe-filename.ts`.
- **LAN Fallback:** Dual base URLs (FQDN + LAN IP) in settings. Server-side probe on `/api/ftp-archive/resolve-url` checks FQDN reachability (HEAD, 3s timeout) and falls back to LAN URL for head office users when internet is down. Uses `useArchiveLink` hook in 7 document forms. SSRF-protected: only probes URLs matching configured `ftpBaseUrl`.
- **HO Staff always use LAN-IP** to access archived files — never FQDN. It's a waste of network resources to route internally through the public domain. FTP server LAN IP: `192.168.1.222` (separate NIC from WAN — LAN and WAN traffic don't interfere with each other).
- **Emergency Restore (HO only):** Screen for head office staff to temporarily move an archived file back to the app server when a branch user urgently needs access. The restore is temporary — the next scheduled archive run will move it back to FTP automatically. If the branch still needs it the next day, HO must restore it again manually.
- **Archive Engine:** 3 parallel FTP connections (`FTP_CONCURRENCY=3`). After verified transfer, source file on local storage is cleaned up. `SAFE_DELETE` flag: when `true` (testing), files are renamed to `.archived`/`.reverted` instead of deleted; when `false` (production), files are actually deleted to free disk space.
- **Auto-Resume:** On startup, `recoverOrphanedTransfers()` resets items stuck in "transferring" → "pending". Scheduler calls `resumePendingItems()` every 5 min to retry pending/failed items. Max 5 retries (`MAX_RETRY_ATTEMPTS`); exhausted items marked permanently failed. Shared `processOneItem()` function handles both new and resumed transfers.
- **Mutual Exclusion (Clone ↔ Archive):** In-memory `_ftpArchiveRunning` flag (set atomically before any async work) prevents concurrent archive runs. Clone DB checks `isFtpArchiveRunning()` before starting. Archive checks `isCloneInProgress()` before starting. Both return 409/skip if the other is active.

**Subscription & Trial System:**
- 9 plans across 3 target groups: general (Starter/Business Pro/Business Plus), ecommerce (eTax Lite/E-Commerce Hub/E-Commerce Pro), firm (Firm Starter/Firm Pro/Firm Enterprise).
- Plans have: `targetGroup`, `setupFee`, `features` (text[]), `maxBranches`, `hasFirmModule`, `hasDeliveryModule` fields.
- **Google reCAPTCHA v2** on login and registration forms — prevents bot logins and signups. Frontend widget (`ReCaptchaWidget`) in `client/src/pages/login.tsx` and `client/src/pages/register.tsx`, backend verification in `server/auth.ts`. Env vars: `VITE_RECAPTCHA_SITE_KEY` (frontend env var), `RECAPTCHA_SITE_KEY` + `RECAPTCHA_SECRET_KEY` (secrets).
- New registrations automatically get a 15-day free trial (status="trial", trialEndsAt set).
- Trial expiry guard in `TrialGuard` component (App.tsx) redirects to `/choose-plan` page when expired.
- Trial banner in layout.tsx shows remaining days with upgrade link.
- Plan selection page at `/choose-plan` with billing cycle toggle (monthly/yearly).
- `/api/auth/me` response includes `subscription` object with `status`, `trialExpired`, `daysRemaining`, `planCode`, `planName`.
- **PromptPay QR Payment Flow:** Customer creates payment order → system generates PromptPay QR code (EMVCo standard, `server/utils/promptpay-qr.ts`) → customer scans and pays → uploads slip → AI verifies (or admin confirms) → subscription auto-extended from current endDate.
- **Payment Orders Table:** `subscription_payment_orders` tracks: tenantId, planId, amount, setupFeeAmount, billingCycle, status (pending/confirmed/rejected), slipImageUrl, invoiceNumber, confirmedBy/At.
- **Platform Payment Config:** PromptPay ID, account name, bank name stored in `system_config` (keys: `PLATFORM_PROMPTPAY_ID`, `PLATFORM_ACCOUNT_NAME`, `PLATFORM_BANK_NAME`, `PLATFORM_AI_AUTO_VERIFY`). Configured at `/platform/payment-settings` (SuperAdmin only). Falls back to hardcoded `0649195196` if not set.
- **AI Slip Auto-Verify:** POST `/api/subscription/verify-slip/:id` — uses GPT-4o-mini Vision to read slip, checks amount (±2%), receiver name, confidence level. If all pass → auto-activates subscription. If fail → sends to admin review. Toggle on/off via `PLATFORM_AI_AUTO_VERIFY` config.
- **Admin Payment Approval:** Platform admin page (`platform/subscriptions.tsx`) has 3 tabs: แพ็คเกจ/สมาชิก/รอยืนยันชำระเงิน. Confirm auto-extends subscription and generates invoice number (INVYYYYMMnnnn).
- **Auto Tax Invoice on Payment:** When subscription payment is confirmed (AI or admin), auto-creates tax invoice under companyId=4 (บริษัท อี แท็กซ์ เซ็นเตอร์) with VAT 7% included pricing. Idempotent — checks existing `taxInvoiceId` and `refDoc=SUB-{orderId}` before creating. Also creates auto journal entry. Links `taxInvoiceId` back to payment order atomically. Guard prevents re-upload on confirmed orders.
- **Landing Page Dynamic Pricing:** 3-tab layout (ธุรกิจทั่วไป/ร้านค้าออนไลน์/สำนักงานบัญชี) fetched from `/api/subscription-plans?group=X`. Monthly/yearly toggle.
- **My Subscription Page:** Shows current plan, usage bars, features, renewal dialog with QR code, slip upload, payment history.
- **Add-on Modules (โมดูลเสริม):** Tables `subscription_addons` + `tenant_addon_subscriptions`. Allows any tenant to buy features individually (White Label ฿490/mo, AI ฿290/mo, HR ฿390/mo, POS ฿390/mo, API ฿190/mo). Active add-ons merge into plan via `featureFlag` field in `/api/my-subscription-info`. Settings tabs show locked state with tooltip for features not in plan/add-on.

**Session Management:**
- **Single-session enforcement:** On login, all other sessions for the same user ID are deleted from the PostgreSQL session table. This means logging in from a second device/browser kicks out the first session. Multiple tabs in the same browser are unaffected (they share one session cookie).
- **Session heartbeat:** `AuthProvider` in `client/src/lib/auth.tsx` pings `/api/auth/me` every 15 seconds. If 401/403, clears auth state, sets `session_kicked` flag in sessionStorage, redirects to `/login`. Login page checks the flag and shows red toast: "ออกจากระบบอัตโนมัติ — คุณถูกออกจากระบบเนื่องจากมีการเข้าสู่ระบบจากอุปกรณ์อื่น". Max 15-second delay before kicked user sees clear explanation.
- **Implementation:** `server/auth.ts` login handler runs `DELETE FROM "session" WHERE sid != $currentSid AND sess->'passport'->>'user' = $userId`.
- **Clone safety:** The clone process runs server-side in an async function — it does not depend on the browser session to complete. Session kick-out during an active clone is harmless.

**Multi-tenant Isolation:**
- Companies filtered by `tenantId` in `/api/companies` endpoint. Admin/manager see only their tenant's companies. Superadmin sees all.
- **Users filtered by `tenantId`** in `GET /api/users`. Admin sees only users in their own tenant. Employee links also scoped to tenant's companies.
- **User CRUD tenant-scoped:** `POST /api/users` auto-links employees only within tenant's companies. `PATCH /api/users/:id` verifies target user belongs to same tenant before allowing edit. `GET /api/users/unlinked-employees` filters by tenant's company IDs.
- Permissions in `/api/permissions/me` use tenant's `tenantType` (not global primary company) to determine module visibility.
- `firm-mgmt` module only visible for `accounting_firm` tenant type (via FIRM_ONLY_MODULES filter).
- **Document ownership guard:** `checkDocOwnership()` in `route-middleware.ts` verifies that GET/PATCH/DELETE by-ID endpoints only return records belonging to the user's tenant. Applied across all document routes (purchases, expenses, sales, HR, journal entries, fixed assets, POS, etc.). Super admins bypass the check. Client role users are additionally restricted to their allowed company IDs.
- **Asset Categories:** DB-backed per-company asset categories (`asset_categories` table) replace hardcoded array. CRUD via `/api/asset-categories`. Defaults seeded on first access. Unique constraint on `(company_id, account_code)`. Page at `/assets/categories`.
- New companies created by tenant users automatically inherit their `tenantId`.
- **Global Company Access Guard (`tenantGuard`):** Applied as Express middleware on all `/api` routes. Checks `companyId` from query, body, and params. Only `super_admin` bypasses. Tenant-bound users blocked from cross-tenant companies. Client role users restricted to their `allowed_company_ids` (cached 5 min, invalidated on update). Fail-closed: errors return 500 instead of allowing access.
- **Client User Auto-Assign:** When creating a client user, the currently selected company is auto-assigned to `allowedCompanyIds`. Frontend company-context clears stale selections when user has no allowed companies.
- **HR Primary Company Binding:** For accounting firms, all HR pages use `useHrCompanyId()` hook (from `company-context.tsx`) which returns `primaryCompanyId` instead of `selectedCompanyId`. This ensures employees always load from the firm's primary company regardless of which client company is selected in the company switcher. Applied to all 17+ HR pages (employee list, attendance, payroll, payslip, certificates, etc.).
- **Contact Duplicate Prevention:** All contact creation paths (firm client creation, purchase auto-create, startup backfill, import) check for existing contacts by taxId and name (case-insensitive) before creating new ones. Matches any active contact regardless of type (customer/vendor/both).
- **Contact Duplicate Detection & Merge:** `GET /api/contacts/duplicates` finds contacts with same taxId in same company. `POST /api/contacts/merge` atomically moves all document references (20 tables) from duplicate contacts to the kept one, then deactivates duplicates. Uses DB transaction, validates company ownership, parameterized queries (no SQL injection). UI: "ตรวจซ้ำ" button on contact list page with radio selection for which to keep per group.
- **Firm Client Duplicate Prevention:** POST /api/firm-clients checks name (case-insensitive) and taxId against existing clients in the same tenant before creating. Import endpoint skips duplicate rows (by name or taxId) and tracks within-file duplicates.
- **Purchase Tax Invoice Ref Duplicate Check:** POST/PATCH for purchase invoices and expenses checks `taxInvoiceRef` for duplicates across both `purchase_invoices` and `expenses` tables within the same company. Returns 409 with the conflicting document number.
- **Document Number Format Validation:** When users manually enter/edit a document number, the system validates it matches the company's configured format (prefix + year + optional month/day + running digits). Applied to: quotation (QO), sales order (SO), invoice (IV), tax invoice (TIV), receipt (RC), purchase order (PO), purchase invoice (AP), expense (EXP). Uses `validateDocNumberFormat()` from `shared/document-types.ts` and `validateDocNo()` helper from `server/route-helpers.ts`.
- **Global Tenant Guard:** `tenantGuard` middleware in `route-middleware.ts` intercepts all `/api/*` requests. If request includes `companyId` (query or body), validates the company belongs to the user's `tenantId`. Returns 403 if mismatch. Uses in-memory cache (5-min TTL). Registered globally after `setupAuth` in `routes.ts`.
- **HR Company Isolation:** `employees` table has both `tenant_id` and `company_id` columns. All HR endpoints accept `companyId` query param and filter employees by company. Auto-backfill on startup assigns `company_id` = primary company for employees with null `company_id`. All 16 HR frontend pages pass `companyId` from `useCompany()` when fetching employees.
- **Employee Role Restrictions:** Employee-role users see only basic info (name, position, department) of other employees. Salary/sensitive data visible only for their own record. OT and leave endpoints return only their own records.
- **Payroll Tenant Guard:** All payroll endpoints (GET/POST/batch/journal) validate that `companyId` belongs to the user's tenant before processing.

## Stage 2: Developer Menu (Local Testing)
- **Architecture:** Dev menu bar with inline switch/clone controls + dedicated switch page (superadmin only).
- **Dev Menu Bar:** Color-coded bar (blue-cyan=USA, amber-orange=Thailand) at top of every page. Includes: DB status indicator, toggle switch button ("สลับไป TH/USA"), clone button with progress, TH offline warning. Height: 32px. Component: `client/src/components/dev-menu.tsx`.
- **Database Switch Page:** Full switch/clone controls at `/platform/db-switch` (superadmin only). Component: `client/src/pages/platform/database-switch.tsx`. Added to platform nav sidebar.
- **Hot-Swap (Option 1):** Server swaps database pool in-memory without `process.exit()`. No manual restart needed on localhost. `hotSwapDatabase()` in `server/db.ts` tears down old pool and creates new one. Uses Proxy pattern so all existing `db` and `pool` references auto-update.
- **Multi-Tab Reload:** On switch, signals all browser tabs via `BroadcastChannel` + `localStorage` event. All tabs navigate to `/landing`.
- **Session Invalidation:** Switch destroys the triggering user's session. All users must re-login after switch.
- **Config:** `DATABASE_URL_TEST` env var points to `etax_center_test` on deep-main.
- **Choice persistence:** `.dev-db-choice` file stores selected database (gitignored).
- **Production safety:** All `/api/dev/*` routes wrapped in `if (NODE_ENV !== "production")`. Switch/clone require `requireSuperAdmin`. Indicator auto-hides when API returns no data.
- **deep-main availability:** Online 24/7, home fiber (2000/1000 Mbps). Indicator shows status.
- **Files:** `server/db.ts` (connection logic + hot-swap), `client/src/components/dev-menu.tsx` (indicator), `client/src/pages/platform/database-switch.tsx` (switch controls), routes in `server/routes.ts` (dev API endpoints).
- **Version Badge:** Git short hash displayed next to sidebar logo (e.g. `v.fcb44ab4`). Tooltip shows full date and commit message. API: `GET /api/version` returns `{ hash, shortHash, date, message }`. Uses `git rev-parse` at server startup. Clickable in dev bar to open Git Status panel.
- **Git Version Comparison Panel:** Dialog opened by clicking version badge in dev bar. Shows side-by-side comparison of local machine vs GitHub latest (branch, date in Thai Buddhist Era, commit hash, commit message). Status indicator: green "เวอร์ชันเดียวกัน" / amber "โค้ดบนเครื่องเก่ากว่า (ห่าง N commits)" / gray "ไม่พบ GitHub Remote". Two actions: "ใช้เวอร์ชันปัจจุบัน" (dismiss) or "อัปเดตเป็นเวอร์ชันล่าสุด" (git pull + stash/pop). API: `GET /api/dev/git-status` (requireAuth, fetches with GIT_TERMINAL_PROMPT=0), `POST /api/dev/git-pull` (requireSuperAdmin). Designed for non-IT team members running `npm run dev` locally.

## Central Config Database System
- **Purpose:** Replace `.env` files across all dev machines with a single PostgreSQL config table. Any machine only needs one bootstrap URL (the Config DB) to get all credentials.
- **Config DB:** Replit PostgreSQL (`DATABASE_URL` env var). Contains `system_config` table with key-value pairs for all environment settings.
- **Table:** `system_config` — columns: `id`, `config_key` (unique), `config_value`, `description`, `environment` (all/production/development), `is_secret` (boolean), `updated_at`.
- **Bootstrap Flow:** On app startup: `bootstrapConfig()` reads all config from `system_config` table → `reinitializeFromConfig()` switches DB pool to `DB_MAIN_URL` if set (otherwise stays on Replit DB). Fallback: if config DB unavailable, uses env vars.
- **Config Keys:** `DB_MAIN_URL` (main/production DB), `DB_TEST_URL` (test DB), `PROMPTPAY_ID`, `LINE_CHANNEL_ACCESS_TOKEN`, `RESEND_API_KEY`, `FTP_HOST`, `FTP_PORT`, `FTP_USER`, `FTP_PASSWORD`, and more.
- **API Endpoints (admin only):** `GET /api/admin/system-config` (list, masks secrets), `PUT /api/admin/system-config/:key` (update), `POST /api/admin/system-config` (create), `DELETE /api/admin/system-config/:key`.
- **Files:** `server/config-bootstrap.ts` (bootstrap logic + getConfig/setConfig helpers), `server/db.ts` (uses getConfig for DB URLs), `shared/schema.ts` (systemConfig table definition).
- **Future (Step 3):** When Thailand office server is ready, Config DB moves to local PostgreSQL. All machines point to that instead of Replit.
- **Note:** Replit has no static IP. Thailand server must allow `*.*.*.*` for Replit connections.

### ⚠️ DATABASE ARCHITECTURE — READ THIS FIRST WHEN DEBUGGING DATA ISSUES
**Dev and Production use COMPLETELY SEPARATE databases. Data in one does NOT exist in the other.**
- **Replit DATABASE_URL** = Replit-hosted PostgreSQL → used ONLY for schema sync / local dev fallback
- **DB_MAIN_URL** (from system_config) = the ACTUAL database the running app connects to after bootstrap
- If data exists in production but not in dev (or vice versa), it is NOT a bug — they are separate databases.
- **NEVER assume** data seen in production UI exists in Replit's DATABASE_URL. Always check which DB the app is connected to first.

### Thailand Server Infrastructure (tax-gateway.hopto.org)
- **Hardware:** Intel Xeon E5-2680 (8C/16T, 2.7-3.5GHz), 32GB DDR3, Windows Server 2022, 3BB Dynamic 2.5Gb WAN (dedicated NIC)
- **PostgreSQL v15:** Port 5432 (DO NOT TOUCH — used by another team)
- **PostgreSQL v16.10:** Port 25674 (ours)
- **Apache 2.4:** HTTP (no SSL), root = FTP root directory
- **FTP:** Port 3257 (already configured)
- **3 Databases on v16 (port 25674):**
  - `db_rp_dev` / `replit_dev` → Dev (DB_MAIN_URL) ← **app connects here after bootstrap**
  - `db_rp_pdt` / `replit_pdt` → Production (DB_PROD_URL)
  - `db_rp_tst` / `replit_tst` → Test/Backup (DB_TEST_URL) — **TEMPORARY** location, see TODO below

### ⚠️ TODO: When deep-main ISP link is fixed
The test/backup database (`db_rp_tst`) is temporarily on tax-gateway because deep-main's internet link went bad. When ISP fixes deep-main:
1. **On deep-main server:** Create database `db_rp_tst`, user `replit_tst` with password `d937fd2dfa0ce288ced00468ab532e38`
2. **Update system_config:** Change `DB_TEST_URL` from `tax-gateway.hopto.org:25674` → `deep-main.hopto.org` (with correct port)
3. **Verify connection** from Replit before switching
4. Old deep-main DB was `etax_center_test` / `etaxuser` — can be retired after migration

## Clone Database System (Production → Thailand) ✅ COMPLETE
- **Purpose:** Replicate production database to Thailand test server (tax-gateway.hopto.org) for local team access.
- **Status:** Fully operational. Batch-optimized. US→TH static clone: 64 tables in ~5 min (296s, Round 4).
- **Clone Types:** 3 types via wizard — (1) Static Data Only, (2) Transaction Data Only, (3) Manual table selection.
- **Table Categories:** Defined in `server/clone-tables.ts` — STATIC_TABLES (66 tables: config, users, products, etc.) and TRANSACTION_TABLES (131 tables: invoices, journals, orders, etc.).
- **Clone Engine (Batched):** Pre-counts all tables in one query. Groups ≤500-row tables into batches of 15 per `pg_dump` call; large tables stay individual. Reduces 63 connections → ~6 batches. `SET session_replication_role = replica` disables FK checks during restore. Tables not found in source are automatically dropped from target.
- **Wizard Frontend:** `client/src/pages/platform/database-backup.tsx` — 5-step wizard (select type → select direction → select tables → confirm with space check + time estimate → real-time progress). Recovery mode for failed tables. Clone history sidebar from DB.
- **Progress Tracking:** In-memory `platformCloneProgress` object polled every 2s. Shows current batch/table, table index/total, percent, elapsed time, dump speed, restore speed. Resume on page revisit via `startedAt` timestamp. Navigation warning overlay (replaces browser alert).
- **Clone History:** Stored in `clone_history` DB table (per-table records with sessionId, rowCount, host/remote duration, status, error, dumpFileSize, dumpSpeed, restoreSpeed). Auto-purge: keeps only last 5 success records per table after each clone.
- **Time Estimate:** `/api/platform/clone-estimate` — averages last 3-5 records per table. Tables with <3 records use fallback (mean of known tables). `hasEnoughData = true` when ≥50% of tables have ≥3 records. Self-corrects as more clones run.
- **History Duration:** Wall-clock time (earliest startedAt → latest completedAt per session), not sum of per-table durations (which inflates with batching).
- **Maintenance Integration:** Clone auto-activates maintenance (source: "clone_database"), sets `cloneInProgress=true` to hard-block manual lift. On success: auto-lifts maintenance + destroys schedule. On failure: reschedules 1 hour later. `freezeTimer` on clone screen enter, `unfreezeTimer` on leave.
- **Screen Lock:** Single-user lock via `cloneScreenUserId`. Only one superadmin can be on the clone screen at a time.
- **Server-side Guards:** (1) Reject clone if maintenance active from non-clone source (409). (2) Hard-block manual `/api/maintenance/disable` whenever `cloneInProgress=true`. (3) Reject if clone already running (409). (4) No CASCADE on DROP (protects dependent objects).
- **Space Check:** Pre-clone disk space verification on target via `GET /api/platform/clone-space-check`. Calculates required space as 1.5x largest table.
- **API Routes:** `POST /api/platform/clone-db`, `GET /api/platform/clone-progress`, `GET /api/platform/clone-history`, `GET /api/platform/clone-tables`, `GET /api/platform/clone-estimate`, `GET /api/platform/clone-space-check`, `POST /api/platform/clone-screen-enter/leave`, `GET /api/platform/clone-last-failed`, `POST /api/platform/clone-dismiss-failed`.
- **Config:** `DATABASE_URL_TEST` env var for target database.
- **Performance History:** Round 1-3 (per-table): ~10.5s/table, 662s total. Round 4 (batched): ~5 min (296s), 2.2x improvement. Bottleneck is per-connection overhead to TH server, not bandwidth.

### Clone Safety — Half-Baked Recovery & Platform Alert
- **Auto-Resume Lift:** When autoResumeClone detects no missing tables but maintenance lock is stuck → auto-lifts maintenance.
- **Retry Exhausted (non-active DB):** If half-baked clone target is NOT the active DB → lifts maintenance, sends LINE alert to platform user.
- **Retry Exhausted (active DB - CRITICAL):** If half-baked clone target IS the active DB → keeps lock, sends LINE alert (🚨), starts 30min timeout. If platform user doesn't act → auto-switches DB back to source (USA) via `emergencySwitchToSource()`.
- **Emergency Switch:** `emergencySwitchToSource()` in `server/db.ts` — works even in production mode (unlike hotSwapDatabase). Used for half-baked clone recovery.
- **LINE Alert:** `sendPlatformLineAlert()` in `server/maintenance.ts` — finds super_admin's lineId, sends LINE push message.
- **Platform User Popup:** `GET /api/platform/clone-incomplete-alert` — returns half-baked clone info (halfBakedOnActiveDb, failedTables, maintenanceLocked). Layout.tsx polls every 30s for super_admin users. Shows critical red popup if on active DB with switch-back button; amber if on non-active DB with dismiss option.
- **Switch-Back API:** `POST /api/platform/clone-switch-back` — emergency switch DB to source + lift maintenance + cancel timeout.
- **Dismiss API:** `POST /api/platform/clone-dismiss-incomplete` — marks error tables as dismissed + cancels timeout.
- **Timeout:** `startHalfBakedTimeout()` / `cancelHalfBakedTimeout()` in `server/maintenance.ts` — configurable timer (default 30min).

### Database Separation for Crash Isolation (3-Pool Architecture)
- **Purpose:** Isolate high-volume modules (E-Commerce, POS) from accounting so if they crash/slow, accounting continues working.
- **3 connection pools:**
  - `db` (main) — Accounting, HR, core tables. Always `DATABASE_URL`. File: `server/db.ts`.
  - `ecomDb` — E-Commerce Hub. Uses `DATABASE_URL_ECOM` (falls back to `DATABASE_URL`). File: `server/ecom-db.ts`.
  - `posDb` — POS & Restaurant. Uses `DATABASE_URL_POS` (falls back to `DATABASE_URL`). File: `server/pos-db.ts`.
- **22+ files updated for ecom, 5 files for POS.** Accounting queries remain on `db`.
- **Schema sync:** `db-schema-sync.ts` auto-syncs module tables to separate DBs on startup when env vars are set.
- **Ecom tables:** ecommerce_connections/orders/order_items/product_mappings/settlements/returns, sync_logs, oauth_states, facebook_chat_orders/pages, chat_orders, platform_chat_threads, stock_sync_logs, vat_product_dictionary, live_sessions, lucky_draw_*, ad_budgets/campaigns, **tax_invoices, tax_invoice_items, sales_credit_notes, sales_credit_note_items, document_settings**.
- **POS tables:** pos_sessions/transactions/transaction_items, restaurant_areas/tables/orders/order_items, menu_categories/items/modifiers, kitchen_tickets, products, product_bundles, product_stock, product_lots, stock_movements, warehouses, warehouse_stock_levels, stock_transfers/items, **branches, payment_methods, document_settings, tax_invoices, tax_invoice_items**.
- **Standalone module support:** Each module (POS/E-Commerce) can issue tax invoices independently using its own DB — no dependency on accounting DB. `getNextDocNo()` accepts optional `dbConn` parameter so each module queries its own document_settings and doc number sequences. Enables selling modules separately as standalone products.
- **Bridge pattern (when accounting module is active):** Cross-module operations read from module DB, sync summaries to accounting DB. Journal entries only created when accounting module is purchased.
- **Module Sync Engine:** `server/module-sync-engine.ts` — syncs documents from module DBs to accounting DB. Only activated when customer has accounting module. APIs: `/api/module-sync/run` (manual sync), `/api/module-sync/status`, `/api/module-sync/logs`, `/api/module-sync/retry-errors`, `/api/module-sync/auto-sync` (start/stop periodic sync). Tracking table: `module_sync_logs`. Creates journal entries in accounting DB from POS transactions and e-commerce tax invoices/credit notes.
- **Production setup:** พี่ช้าง sets `DATABASE_URL_ECOM` and/or `DATABASE_URL_POS` for full crash isolation.

### Database Server Landscape (5 machines)
| # | Machine | OS | Remote DB | Role |
|---|---------|-----|-----------|------|
| 1 | Replit (Neon) | Cloud | Yes | Dev source (current) |
| 2 | deep-main | Windows | Yes | Production (current) |
| 3 | Linux aaPanel #1 | Linux | No | Stage 3 testing |
| 4 | Linux aaPanel #2 | Linux | No | Final production destination |
| 5 | Windows Backup (new) | Windows | Yes | Backup DB + History DB (read-only) |
- **Windows = remote Clone possible.** Linux = must Clone locally (Standalone Clone Tool needed).
- **Stage 2 milestone:** Both dev and production CAN be in Thailand.
- **TODO:** Clone system currently hardcodes usa/thailand — needs to support multiple targets.
- **TODO:** `emergencySwitchToSource` hardcodes USA as source — needs to know the real source dynamically.
- **TODO:** Half-baked timeout (30min default) should be configurable by platform user.

### Database Baseline & Version Tracking (Updated: 13/04/2569)
**schema_version table** exists on ALL databases (Neon=v88, Production=v87, Main=check). Kai writes ONLY to Neon; production/main updated via พี่ช้าง pull+build+restart.

**Principle:** Kai can READ all databases anytime. Every schema/data change goes through Kai's code, so Kai knows BEFORE any DB is altered. No excuse to "not know" what's in each DB.

| Database | journal_entries | journal_lines | fixed_assets | asset_depreciations | companies | users | schema_version |
|----------|----------------|---------------|--------------|---------------------|-----------|-------|----------------|
| Replit Neon (Dev) | 7,191 | 21,574 | 248 | 7,993 | 450 | 29 | v88 |
| Production (deep-main) | 28 | 78 | 248 | 8,001 | 453 | 50 | v87 |
| Main DB | 10 | 27 | 0 | 0 | 448 | 24 | — |

**Key data differences:**
- **Neon:** Most journal entries (payroll, invoices, expenses, petty cash) — NO depreciation journals
- **Production:** Has depreciation data (1 DEP journal entry, 8001 depreciation records) — real user testing here
- **Main:** Minimal data, no fixed assets — dev/staging only

**Push tracking:** Every push gets a sequential number per day. Example: Push #1 (13/04/2569), Push #2, etc.

### 🔖 FUTURE: Standalone Clone Tool
- **Plan:** Extract clone database feature into a standalone Node.js project, publishable on Windows (target: tax-gateway server).
- **When:** AFTER clone database function is fully closed — all types (static/transaction/manual), all directions (US→TH, TH→US) tested and baselined.
- **Blocked by:** Currently only US→TH Static has real baseline data. Other type/direction combinations need testing first.
- **Context:** Stage 3 (Debian + aaPanel on same test machine) may happen first, which would provide a better testing matrix.
- **Deliverable:** Clean isolated folder within this project, ready to copy to a new repo/Windows machine.
- **Critical for Linux machines (#3, #4):** Only way to Clone data since they don't allow remote DB connections.

## Maintenance Booking System ✅ COMPLETE
- **Purpose:** Schedule and manage system maintenance windows with countdown timer and user notifications.
- **DB Table:** `maintenance_schedules` — stores scheduledAt, message, status (pending/active/completed/cancelled), source (manual/clone_database), cloneInProgress flag, cloneSessionUserId, completedDate.
- **Server Logic:** `server/maintenance.ts` — state management (enabledInMemory + activeScheduleId), timer setup/teardown, auto-activation at scheduled time, daily limit check, startup recovery for active/pending schedules.
- **Clone Integration:** `createScheduleForClone()`, `setCloneInProgress()`, `rescheduleForCloneFailure()` (1 hour later), `destroyScheduleAfterClone()`.
- **Frontend:** Maintenance status bar shown to all users when active. Clone screen integrates freeze/unfreeze timer. Login page polls maintenance status every 30s.

## e-Tax Invoice (PDF/A-3) Integration
- **Standard:** ETDA ขมธอ. 3-2560 / กรมสรรพากร ประกาศ พ.ศ. 2566
- **Format:** PDF/A-3 (ISO 19005-3:2012) with embedded XML, XMP metadata, ICC profile, fonts
- **XML Generator:** `shared/etax-xml.ts` generates CrossIndustryInvoice XML (namespace `rsm:`, `ram:`, `udt:`, `qdt:`)
- **Document Types:** Tax Invoice (388), Debit Note (80), Credit Note (81)
- **XML Schema:** Document Context, Document Heading, Trade Agreement (Seller/Buyer), Trade Delivery, Trade Settlement, Line Items
- **Settings:** Per-company e-Tax configuration stored in `companies` table (etaxEnabled, etaxEmail, etaxTimestampEmail, sellerBranchId, sellerPostcode)
- **Settings Page:** `/settings/etax` — enable/disable, email config, seller info, test XML download
- **API Routes:** `server/routes/etax-routes.ts` — GET/POST settings, generate XML, test XML, email subject, generate PDF/A-3, send email
- **PDF Generator (Server-side):** `server/pdf-react-generator.tsx` — uses `@react-pdf/renderer` to generate PDFs directly on the server WITHOUT Chromium/browser. Thai font: Sarabun (TTF in `server/fonts/`). Supports all document types (QO, IV, TX, RC, SO, etc.). Concurrent-safe: 10 simultaneous PDFs use only ~20MB RAM (vs ~1GB with Chromium).
- **PDF Data Fetcher:** `server/pdf-data-fetcher.ts` — gathers all document data from DB (company, settings, items, images) and converts to PDF template format. Supports lookup by ID or shareToken.
- **PDF/A-3 Generator:** `server/etax-pdf-a3.ts` — converts server-generated PDF to PDF/A-3 (ISO 19005-3) using pdf-lib. Embeds XML as attachment, adds XMP metadata (pdfaid:part=3, conformance=U), ICC color profile (sRGB), OutputIntent, MarkInfo.
- **PDF Engine (pdfmake):** All PDF routes now use `server/pdf-pdfmake-generator.ts` (pdfmake + Sarabun font embed). No Chromium/Puppeteer needed — saves ~100-200MB RAM per render. Font embedded directly in PDF = no font corruption.
- **Legacy PDF files (not used by routes):** `server/pdf-puppeteer-service.ts`, `server/pdf-html-renderer.ts` — old Chromium/Puppeteer-based generators. Kept as backup but no longer imported by any routes.
- **e-Tax Stamp:** Logo + text displayed at document footer when etaxEnabled (document-renderer.tsx)
- **Email Subject Format:** `[วันเดือนปี พ.ศ.][INV|DBN|CRN][เลขที่เอกสาร]`
- **Email Sending:** Via Resend API. Sends PDF/A-3 attachment + HTML body. CC to timestamp email (etaxTimestampEmail) + seller email. Falls back to etaxBuyerTestEmail if buyer has no email.
- **Time Stamp System:** CC email to `csemail@etax.teda.th` for ETDA timestamp verification
- **Frontend Buttons:** 3 buttons on tax invoice form (XML, PDF/A-3, ส่ง Email). Same 3 actions in ecommerce-documents dropdown.
- **Registration:** Companies must register with Revenue Department (rd.go.th) and test with ETDA before going live

**Share Link System:**
- All share links use `getShareBaseUrl()` from `client/src/lib/queryClient.ts` which fetches from `/api/share-base-url`
- Server endpoint auto-detects: in production uses `req.host`, in dev uses `REPL_ID.replit.app` (publicly accessible)
- Server-side email share URLs also use this pattern
- Covers: quotation, sales order, invoice, tax invoice, receipt, purchase request/order/invoice, expense, WHT cert
- Updated files: 11 list pages + server/routes.ts

## Stage 3 TODO — Database Performance Optimization
**IMPORTANT: Do not add indexes until all business requirements are finalized and approved.**

Once Stage 3 begins, revisit the JOIN inventory below and add appropriate indexes:

**INNER JOINs (high priority for indexing):**
- `firm_client_team.employeeId → employees.id` (routes.ts:830,924,949)
- `product_stock.productId → products.id` (routes.ts:6952)
- `ecommerce_order_items.orderId → ecommerce_orders.id` (routes.ts:10134,10157,10236)
- `ecommerce_return_items.returnId → ecommerce_returns.id` (routes.ts:10883,10891,10913,10936)
- `ecommerce_product_mappings.productId → products.id` (routes.ts:20679)
- `journal_lines.journalEntryId → journal_entries.id` (**7 joins** — highest volume, routes.ts:22346-22462)

**LEFT JOINs:**
- `journal_lines.accountId → accounts.id` (routes.ts:2358,2413 — GL report)
- `deposit_receipts.customerId → contacts.id` (routes.ts:3347)
- `purchase_deposits.vendorId → contacts.id` (routes.ts:3720)
- `ecommerce_orders.id → subquery` (routes.ts:10199, storage.ts:1770)
- `packing_recordings.cameraId → packing_cameras.id` (routes.ts:10565,10652)
- `commission_records.employeeId → employees.id` (hr-routes.ts:1898)
- `commission_records.ruleId → commission_rules.id` (hr-routes.ts:1899)
- `firm_clients.assignedTo → employees.id` + `firm_clients.companyId → companies.id` (storage.ts:624-625)

**IN-clause patterns (20 occurrences):** Many use `sql.join(ids)` with dynamic ID lists — consider batch optimization or temp tables for large datasets.

**Report Execution Timing (Baseline System):**
- All 13 report endpoints instrumented with `logReportTiming()` — logs execution time, row count, cache hit/miss
- Console output: `[OK]` <1s, `[SLOW]` >1s, `[CACHE]` for cache hits
- API endpoints (admin only):
  - `GET /api/report-timing/summary` — avg/min/max per endpoint, sorted by slowest
  - `GET /api/report-timing/log` — full log (last 500 entries)
  - `POST /api/report-timing/clear` — reset timing data
- Instrumented reports: general-ledger, trial-balance, income-statement, balance-sheet, cash-flow, income-statement-compare, balance-sheet-compare, financial-statements-package, financial-ratios, sales-tax, purchase-tax, vat-pp30, sales-summary, gross-profit, opex-capex, growth-trend, department-pl
- Code: `server/routes/report-cache.ts` (timing functions), `server/routes.ts` (instrumentation)

**Table Classification (204 tables total):**

*Static/Master Data (rarely change, low volume — 50 tables):*
- **Identity:** tenants, users, session, role_permissions, user_sub_permissions, api_keys
- **Organization:** companies, departments, branches, employees, work_locations, work_schedules, shifts, employee_shift_assignments
- **Accounting Setup:** accounts, accounting_formulas, accounting_formula_lines, document_settings, payment_methods, general_settings, contact_settings, closed_periods, financial_notes, financial_statement_settings
- **Contacts/Products:** contacts, products, product_bundles, bom_headers, bom_lines, product_mappings, customers
- **E-commerce Setup:** ecommerce_connections (includes `doc_prefix` for per-store tax invoice numbering, e.g. SH01, LZ01, TK01), ecommerce_product_mappings, stock_sync_settings, tenant_platform_credentials
- **Warehouse Setup:** warehouses, warehouse_zones, warehouse_bins, product_bin_assignments
- **HR Setup:** ot_settings, holidays, commission_rules
- **POS/Restaurant Setup:** menu_categories, menu_items, menu_modifier_groups, menu_modifier_options, menu_item_modifiers, restaurant_areas, restaurant_tables, packing_cameras
- **Promotions:** promotions, promotion_rules
- **Subscription:** subscription_plans, tenant_subscriptions, white_label_settings, landing_content
- **Work Mgmt Setup:** work_boards, work_board_groups, work_board_columns, task_boards, task_board_members, task_columns
- **FTP/Archive Setup:** company_folder_codes, store_folder_codes (FTP credentials/config moved to system_config — core infrastructure, excluded from clone)
- **Other Config:** line_recipients, line_group_mappings, chat_auto_rules, review_auto_replies, supplier_portal_tokens, oauth_states, vat_product_dictionary, schema_version

*Transaction Data (high volume, grow continuously — 154 tables):*
- **Accounting (HIGHEST PRIORITY):** journal_entries, journal_lines, vat_closings, bank_statements
- **Sales Documents:** quotations, quotation_items, sales_orders, sales_order_items, invoices, invoice_items, tax_invoices, tax_invoice_items, receipts, receipt_items, receipt_linked_docs, billing_notes, billing_note_linked_docs, deposit_receipts, deposit_deductions, sales_credit_notes, sales_credit_note_items
- **Purchase Documents:** purchase_requests, purchase_request_items, bid_comparisons, bid_comparison_items, bid_vendors, purchase_orders, purchase_order_items, purchase_invoices, purchase_invoice_items, expenses, expense_items, payment_vouchers, payment_voucher_linked_docs, purchase_deposits, purchase_deposit_deductions, purchase_debit_notes, purchase_debit_note_items, withholding_tax_certs, wht_cert_items
- **E-commerce Transactions:** ecommerce_orders, ecommerce_order_items, ecommerce_returns, ecommerce_return_items, ecommerce_settlements, ecommerce_settlement_items, ecommerce_import_batches
- **Inventory:** product_stock, stock_movements, warehouse_stock_levels, stock_transfers, stock_transfer_items, goods_receivings, goods_receiving_items, goods_requisitions, goods_requisition_items, stock_sync_logs
- **Fulfillment:** fulfillment_batches, fulfillment_items, picking_waves, picking_wave_items, packing_recordings
- **HR Transactions:** attendance_records, ot_records, leave_requests, payroll_records, payroll_adjustments, commission_records, evaluation_periods, evaluation_results
- **POS Transactions:** pos_sessions, pos_transactions, pos_transaction_items, restaurant_orders, restaurant_order_items, kitchen_tickets, bill_splits, petty_cash_funds, petty_cash_transactions
- **Live Selling:** live_sessions, live_session_products, live_cf_orders, live_cf_items, live_payments, live_session_metrics, live_aida_actions, live_session_reports, live_ad_budgets, live_agency_clients, lucky_draw_campaigns, lucky_draw_prizes, lucky_draw_entries
- **Fixed Assets:** fixed_assets, asset_depreciations
- **Chat/Social:** chat_messages, platform_chat_threads, platform_chat_messages, facebook_pages, facebook_chat_orders
- **Documents/Logs:** document_delivery_logs, activity_logs, accounting_mgmt_logs, sync_logs, sync_job_queue, ftp_archive_jobs, ftp_archive_items, line_documents
- **Work/Task Items:** work_board_items, work_status_boards, work_status_groups, work_status_columns, work_status_rows, work_status_cells, work_status_attachments, tasks, task_assignees, task_comments
- **Contracts/Supplier:** contracts, supplier_quotes, supplier_quote_items, demand_forecasts
- **Firm Management:** firm_clients, firm_client_team, firm_documents, firm_folders
- **Notifications:** notifications
- **Ads:** ad_campaigns, ad_spend_entries
- **Archive:** archive_ecommerce_orders, archive_journal_entries, archive_journal_lines, archive_runs

## Target Production Server
- **Hardware:** Dell PowerEdge R640 (1U Rack)
- **CPU:** 40 cores total (2x Intel Xeon Scalable)
- **RAM:** 256 GB DDR4
- **Storage:** RAID 6 (single drive group)
- **Network:** 1000/1000 Mbps symmetric
- **Estimated capacity (current config):** ~500-1,000 concurrent users
- **Estimated capacity (tuned — PM2 cluster, pool=50, Nginx, PG tuned):** ~5,000-8,000 concurrent users
- **Deployment recommendations:** PM2 cluster 4-8 workers, DB pool 30-50, Nginx for static/SSL, PostgreSQL shared_buffers=64GB, SSD for DB storage

## FTP Archive — Multi-Session Development Roadmap

**Purpose:** This section preserves full context for the FTP Archive feature across chat resets. Kai must read this section at the start of every new session to continue work without repeating questions or re-exploring code.

**Key People:**
- พี่ช้าง = infra dev / project owner — designs architecture, makes deployment decisions
- พี่ทราย (Sai) = business person

**Thailand Server:**
- Host: `tax-gateway.hopto.org:25674` (PostgreSQL 16.10, Windows Server 2022)
- FTP port: 3257, user: Tax-App
- Disk path: `D:\Server\Websites\Default\fa` (29 chars) — Apache DocumentRoot = FTP root
- `NTFS_ROOT_OVERHEAD = 45` (conservative buffer for 260-char NTFS limit)
- ftpBaseUrl: `http://tax-gateway.hopto.org/fa/archive`
- Online hours: 24/7 (home fiber 2000/1000 Mbps)

**Architecture Decisions (locked in):**
- FTP Archive = core infrastructure, NOT tenant feature. Config lives in `system_config` table.
- Clone database must NEVER overwrite FTP config. `system_config` excluded from clone tables.
- Each deployment has independent FTP config (no per-tenant FTP distribution).

**Key Files:**
- `server/services/ftp-archive.ts` — archive engine, auto-resume, processOneItem, mutual exclusion lock
- `server/platform-scheduler.ts` — scheduler calls recoverOrphanedTransfers on startup, resumePendingItems every 5 min
- `server/config-bootstrap.ts` — getConfig/setConfig for system_config table
- `server/clone-tables.ts` — clone table list (FTP config excluded)
- `server/maintenance.ts` — isCloneInProgress() flag
- `server/services/folder-codes.ts` — company/store folder code generation
- `server/utils/safe-filename.ts` — NTFS-safe filename sanitization
- `client/src/pages/settings/ftp-archive.tsx` — Platform admin FTP settings UI
- `client/src/hooks/use-archive-link.ts` — LAN fallback hook (7 document forms)
- `client/src/components/platform-layout.tsx` — Platform sidebar menu

### Development Plan (5 Steps)

**Step 1: Auto-resume survives normal restart** ✅ DONE (2026-03-07)
- `recoverOrphanedTransfers()` — resets "transferring" → "pending" on startup
- `resumePendingItems()` — retries pending/failed items every 5 min
- `processOneItem()` — shared transfer function (extracted from runArchiveJob)
- `cleanupObjectStorage()` — shared cleanup function
- `MAX_RETRY_ATTEMPTS = 5` — exhausted items marked permanently failed
- `_ftpArchiveRunning` flag — atomic lock before any async work
- Mutual exclusion: Clone checks `isFtpArchiveRunning()`, Archive checks `isCloneInProgress()`
- **Tested:** Restart showed "Recovered 3 orphaned transfers → reset to pending"

**Step 2: Test retry timeout exits cleanly** ⬜ NOT STARTED
- Simulate failures (FTP server down, partial transfers, network drops)
- Verify that after 5 failed attempts, items stop retrying and show clear error
- Verify scheduler doesn't get stuck or blocked by permanently-failed items
- Test FTP connection timeout behavior (what happens when tax-gateway is offline)

**Step 3: Re-test clone database** ⬜ NOT STARTED
- Run full clone (static + transaction) after Step 2
- Verify clone doesn't touch system_config or FTP archive tables
- Verify FTP settings on target DB remain unchanged after clone
- Check that mutual exclusion works: try clone while archive is running → expect 409

**Step 4: Additional FTP Archive code** ⬜ NOT STARTED
- Any fixes identified from Steps 2-3
- Potential improvements: better error reporting, progress tracking, etc.

**Step 5: Concurrent stress test (Clone + Archive)** ⬜ NOT STARTED
- Start both operations simultaneously
- Verify mutual exclusion prevents overlap
- If one starts first, the other must wait/skip gracefully
- Check database integrity after both complete

### Step 6 (Post-Completion): Attachment URL Safety Net 🔧 INFRASTRUCTURE DONE (2026-03-07)
**Problem:** After FTP Archive moves a file, the URL in the database changes (Object Storage → FTP HTTP URL). But users who already have a page open still see the OLD URL in their browser. If they click it → 404 → confusion. We do NOT want auto-refresh on every page — that's wasteful and bad UX.

**Solution implemented: Enhanced `/api/attachments/download` endpoint as universal resolver**
- Existing endpoint in `server/routes/expense-routes.ts` enhanced with archive-aware fallback chain:
  1. HTTP URLs → validate against `isAllowedRedirectUrl()` (FTP_BASE_URL/FTP_LAN_BASE_URL only) → redirect or 400
  2. Try local storage (original path) → serve if found (covers: file not yet picked up, or mid-transfer)
  3. Try local storage with `pdf-imports/` prefix → serve if found
  4. Try `.archived` suffix in local storage → serve if found (LOCAL FIRST — faster than FTP redirect, covers SAFE_DELETE renamed files)
  5. Query `ftp_archive_items` for archive status:
     - completed → redirect to `archivedUrl` (only after all local copies exhausted)
     - transferring → HTML page with progress bar (% complete, MB, attempt count), auto-refresh 10s
     - pending → HTML page "อยู่ในคิวรอย้าย", auto-refresh 15s
     - failed → HTML page with attempt count, "ติดต่อ HO"
  6. Final 404 → HTML page "ไม่พบไฟล์" with HO contact message
- `resolveArchivedUrl()` returns full context: status, archivedUrl, fileSize, transferredSize, attempts
- `normalizeObjectPath()` handles absolute URLs, `/objects/` prefix, plain paths

**Server-side middleware approach (zero frontend changes — พี่ทราย-safe):**
- `server/attachment-middleware.ts`: Express middleware intercepts `GET /.private/*`, `GET /public/*`, `GET /pdf-imports/*` requests
- Registered in `server/routes.ts` AFTER `setupAuth()` (Passport session required for auth check)
- Same fallback chain (local storage → .archived → ftp_archive_items → status pages) runs server-side
- UI code untouched — `<a href={file.path}>` works transparently, middleware handles resolution
- `expense-list.tsx` still uses `/api/attachments/download?url=` proxy (already existed, no change)
- Both paths (middleware intercept + explicit proxy endpoint) coexist — belt and suspenders

**Security hardening:**
- Open-redirect fixed: `isAllowedRedirectUrl()` validates redirect destinations against FTP_BASE_URL and FTP_LAN_BASE_URL origins only
- `normalizeObjectPath()` extracts object keys from absolute URLs, `/objects/` prefixes, and plain paths
- 202/404 responses return user-friendly HTML pages (not raw JSON) with Thai messages and a "ลองใหม่" retry button

**Remaining work:**
- Test with real archived files to verify redirect chain works end-to-end

### Clone Validation Progress (as of 2026-03-08)
**Goal:** 5 successful runs × each direction × each type = 20 total runs.

| Direction | Type | Status | Avg Duration |
|-----------|------|--------|-------------|
| US→TH Static | ✅ 5/5 DONE | ~312s |
| US→TH Transaction | ✅ 5/5 DONE | ~312s |
| TH→US Static | ✅ 5/5 DONE | ~313s (312-316s) |
| **TH→US Transaction** | **⬜ 0/5 — PICK UP HERE** | est. ~312s |

**Key performance notes:**
- TH→US: dump ~40s/batch (over Pacific), restore <1s (local Replit)
- US→TH: dump ~100ms (local Replit), restore ~70s (over Pacific)
- Both directions converge to ~312s total — network is the bottleneck regardless of direction
- Replit PostgreSQL: 128MB shared_buffers vs TH's 4GB (พี่ช้าง spotted something deeper — to discuss)
- Batch count SQL still uses fallback (temp file fix needs restart to take effect)
- พี่ช้าง sees ~278s on UI (excludes counting phase overhead)

**After TH→US Transaction 5/5 is done:**
- All 20 runs complete → clone system fully validated for bidirectional failover
- Next milestone: Settings screen for system_config (DB connection management via platform admin UI)

### Code Review Notes (2026-03-07)
- Architect review identified: lock acquisition must be atomic (set before async calls) — FIXED
- Retry-limit branch ordering in resumePendingItems was processing exhausted items after early return — FIXED
- Remaining architect suggestion: DB-backed advisory lock for cross-process safety — deferred (single-process deployment for now)

## Mobile Executive Dashboard & Expense Snap OCR
- **Mobile Layout Shell** (`client/src/components/mobile-layout.tsx`): Mobile-first layout wrapper with bottom navigation bar (Dashboard, Expense Snap, Profile tabs)
- **Executive KPI Dashboard** (`client/src/pages/mobile/executive-dashboard.tsx`): Mobile-optimized page at `/m/dashboard` showing Revenue, Expense, Profit, Margin, AR, AP KPI cards with SVG sparkline charts and mini bar chart for monthly trend
- **Expense Snap** (`client/src/pages/mobile/expense-snap.tsx`): Camera/upload page at `/m/expense-snap` that captures receipt photos, sends to AI OCR, and auto-fills expense form for review and saving
- **OCR Backend** (`server/routes.ts` - `/api/expense-snap/ocr`): Uses OpenAI GPT-4o-mini Vision to extract date, vendor, amount, VAT, tax ID from receipt images
- **Expense Save** (`server/routes.ts` - `/api/expense-snap/save`): Creates expense record in `expenses` + `expenseItems` tables from OCR results
- **PWA Enhanced** (`client/public/manifest.json`, `client/public/sw.js`): Updated manifest with shortcuts to mobile pages, improved service worker caching (v5)

## Sales Pipeline & Lead Management
- **Route:** `/sales/pipeline` — Kanban board for managing sales leads and opportunities
- **Database:** `pipeline_deals` (deals with stages, values, contacts), `pipeline_activities` (activity timeline)
- **Stages:** Lead → Qualified → Proposal → Negotiation → Won / Lost
- **Features:** Drag-and-drop stage transitions, deal CRUD, activity timeline, analytics dashboard (win rate, deal cycle, pipeline value), filter by salesperson/search, create quotation (QO) from deal
- **Files:** `client/src/pages/sales/pipeline.tsx`, `server/routes/sales-pipeline.ts`
- **Permissions:** Under "sales" module, sub-module key `sales/pipeline`

## Web B: TRCloud Archive Viewer
- **Purpose:** Standalone tool within E-Tax Center for migrating ~400 TRCloud clients' historical data. Two paths: CSV→ZIP (offline archive) and CSV→Database (read-only viewer).
- **Workflow (ZIP):** Upload CSVs per client → view summary → generate ZIP → download → clear → repeat.
- **Workflow (DB):** Upload CSVs → analyze → import to PostgreSQL → browse data in read-only pages (like locked accounting period).
- **ZIP Format:** Contains `manifest.json` (metadata) + `data/{tableName}.json` (actual data per table). Compressed with zlib level 6.
- **ZIP Viewer:** Upload previously generated ZIP → browse tables → search → print.
- **DB Schema:** `legacy_companies` (imported company info), `legacy_chart_of_accounts` (COA per company), `legacy_contacts` (contacts per company), `legacy_documents` (all doc types: quotation/bill/bn/receipt/po/expense/payment/wht), `legacy_document_items` (line items per document), `legacy_gl_entries` (journal entry headers), `legacy_gl_lines` (journal debit/credit lines). All with cascade delete.
- **Document Types:** quotation (QO), bill/invoice (IV), billing note (BN), receipt (RC), purchase order (PO), expense (EX), payment voucher (PV), withholding tax (WT). Generic `legacy_documents` table with `doc_type` discriminator.
- **GL Import:** Extracts from `gl`/`journal`/`gl_entry` tables (headers) and `gl_tran`/`gl_transaction`/`journal_item`/`gl_line` tables (lines). Links lines to entries via gl_no matching.
- **Reports:** Trial balance, general ledger (per-account with running balance), income statement, balance sheet (with balance check), tax summary (VAT output/input/WHT). All computed server-side from `legacy_gl_lines` + `legacy_chart_of_accounts`.
- **Journal Entry Pages:** List page with search/pagination, detail page with debit/credit lines. Both have print and Excel export.
- **Sidebar Sections:** นำเข้าข้อมูล, เอกสารขาย, เอกสารซื้อ, การเงิน, สมุดรายวัน, การบัญชี, รายงาน, คู่ค้า.
- **Import Engine:** `extractDocuments()` maps CSV tables by name to doc types. `DOC_TYPE_MAP` + `ITEM_TABLE_MAP` configure field mappings per type. Items linked to parent docs by doc_no matching during import.
- **State Management:** `LegacyCompanyProvider` context in `client/src/lib/legacy-company-context.tsx` — shared company selection state across layout and all pages.
- **Routes:** `/legacy-import` (CSV→ZIP), `/legacy-import/import-db` (CSV→DB), `/legacy-import/viewer` (ZIP viewer), `/legacy-import/chart-of-accounts` (COA read-only), `/legacy-import/contacts` (contacts read-only), `/legacy-import/documents/type/:docType` (document list), `/legacy-import/documents/:id` (document detail), `/legacy-import/gl-journal` (GL journal list), `/legacy-import/gl-journal/:id` (GL detail), `/legacy-import/reports/trial-balance`, `/legacy-import/reports/general-ledger`, `/legacy-import/reports/income-statement`, `/legacy-import/reports/balance-sheet`, `/legacy-import/reports/tax-summary`.
- **Backend:** `server/routes/legacy-import.ts` — endpoints: `/api/legacy-import/parse`, `/generate-zip`, `/import-to-db` (transactional), `/companies`, `/chart-of-accounts`, `/contacts`, `/documents` (list by type), `/documents/:id` (detail + items), `/companies/:id` (DELETE), `/read-zip`, `/read-zip-table`, `/gl-entries`, `/gl-entry/:id`, `/gl-lines`, `/gl-summary`, `/reports/trial-balance`, `/reports/general-ledger`, `/reports/income-statement`, `/reports/balance-sheet`, `/reports/tax-summary`.
- **Layout:** `client/src/components/legacy-layout.tsx` — standalone sidebar with theme colors, company switcher popover, collapsible nav groups, "Back to E-Tax" link.
- **Access:** Link from Platform Admin sidebar. Requires authentication.
- **TRCloud tables:** 65 total — GL (22K rows), gl_tran (83K), gl_report (84K), bill (14K), inventory (2.4K), quotation (1.4K), contacts (1.2K), COA (361), assets, HR/payroll suite, WHT, receipts, payments, settings, etc.
- **Data Source Reality:** The Excel files from พี่ทราย are ONE way to pull data from the old system (manual export). Working with Excel gives a clearer picture of the old system's DB structure, but it won't be the exact same thing. The real production migration data will most likely come as .sql files (database dump), not Excel. Do NOT over-invest in Excel-specific import logic — the Excel work is for learning the structure, not the final migration path.
- **History DB destination:** Windows Backup server (#5) will host the imported history data in read-only mode.

## Infrastructure Machines

| # | Name | OS | Role | Hardware | Network |
|---|------|-----|------|----------|---------|
| 1 | **Replit (Neon)** | Cloud | Dev & Current Production | AMD EPYC 9B14 4C/8T @2.6GHz, 62GB RAM | US cloud |
| 2 | **server-e5 (deep-main)** | Windows | DB Source of Truth | Xeon E5-2660 v2, 32GB RAM | deep-main.hopto.org, LAN 192.168.1.100, online 24/7 |
| 3 | **linux-test-01** | Linux | Testing | — | LAN 192.168.1.201, aaPanel |
| 4 | **linux-prod-01** | Linux | Final Production (planned) | **Xeon E3-1230 v3** 4C/8T @3.3-3.7GHz, Motherboard **Asus H97M-E** (Intel H97, LGA1150), **32GB DDR3-1600** dual-channel, M.2 + 4×SATA III | LAN 192.168.1.202, aaPanel |
| 5 | **server-backup** | Windows | Backup | — | LAN 192.168.1.150 |
| 6 | **etaxerp.com** | Windows | Test/Dev App Server | — | etaxerp.com (SSL ready), Apache 2.4, PM2 on port 5000 |

### etaxerp.com Server Details
- **OS:** Windows Server, Apache 2.4 (plain, no aaPanel)
- **App path:** `C:\GitApp\etaxcenter`
- **PM2 home:** `C:\Users\Administrator\.pm2`
- **PM2 port:** 5000
- **Domain:** etaxerp.com (SSL certificate installed)
- **SSL cert:** `D:\Server\Apache24\conf\ssl\etaxerp.com-chain.pem` / `etaxerp.com-key.pem`
- **Apache config:** `httpd-vhosts.conf` (HTTP→HTTPS redirect), `httpd-ssl.conf` (SSL VirtualHost with reverse proxy to localhost:5000)
- **Deploy pipeline:** Replit → GitHub → git pull on server → `npm run build` → `pm2 restart all`
- **Env vars:** `.env` file at project root must have `VITE_RECAPTCHA_SITE_KEY` set BEFORE `npm run build` (Vite bakes it at build time)
- **TODO (deploy day):** `git pull` → `npm run build` → `pm2 restart all` (reCAPTCHA will work after rebuild with .env in place)
- **reCAPTCHA:** Site key registered for etaxerp.com (with and without www) in Google reCAPTCHA admin

**Asus H97M-E specs:** Micro ATX, Intel H97 chipset, LGA1150, 4×DDR3 DIMM (max 32GB), 1×PCIe x16, 3×PCIe x1, 1×M.2 (2260/2280), 4×SATA III 6Gb/s. No overclocking (H97). Best CPU upgrade: Xeon E3-1281 v3 (3.7/4.1GHz, +12% vs current E3-1230 v3).

**All Servers page:** `client/src/pages/platform/all-servers.tsx` (route `/platform/all-servers`) — Infrastructure Management page. Features:
- **Machine grouping:** Grouped by `physicalLocation` (not server type). Dev/Cloud machines shown separately.
- **Official flag:** `isOfficial` boolean — amber highlight + ★ badge, sorted to top
- **Target DB pairing:** `targetDbMachineId` FK → machines (many-to-one). App server picks its DB target (self = local DB, or remote server)
- **NIC management:** `machine_nics` table — per-NIC: name, MAC, IP, subnet mask, port forwarding (db/app), `routerId` FK linking NIC to a router
- **LAN connectivity:** Auto-computed from subnet matching across all machines' NICs
- **Routers:** Independent entities at physical locations. Fields: name, model, LAN/WAN IP, internet type (fixed/dynamic), ISP info, admin credentials (username/password)
- **Domains (`platform_domains`):** Independent entities. Fields: domainName, provider (noip/freedns/other), purpose (ddns/website/app/db/ftp), port, credentials, linked router (FK), linked machine (FK), `isRouterManaged` flag
- **Master password gate:** `INFRA_MASTER_PASSWORD` env var (default: "deep-sysadmin-2024"). Lock/unlock button in page header. Credentials (router admin, domain login, machine DB) hidden until unlocked via `/api/platform/verify-infra-password` POST endpoint
- **Multi-IP per NIC:** `nic_ip_addresses` table — per-NIC: multiple IPs with label, isPrimary flag
- **Clone skip:** `machines`, `machine_nics`, `nic_ip_addresses`, `routers`, `router_domains`, `router_port_forwards`, `platform_domains` are in SKIP_CLONE_TABLES
- **Router Port Forwards:** `router_port_forwards` table — multiple rules per router. Fields: `externalPort` (text, supports ranges like "440-450"), `lanIp`, `internalPort` (if different from ext), `protocol` (TCP/UDP/TCP+UDP), `purpose`. Displayed inline in RouterCard with add/delete. Port field removed from Domain entity — port forwarding is a Router responsibility.

**Encrypted Config File System (พี่ช้าง's config DB architecture):**
- **Purpose:** Each app server has a local PostgreSQL "config DB" storing credentials for ALL known machines. No passwords in `.env` — only `MACHINE_NAME`.
- **Encryption:** AES-256-GCM. Key derived from `SHA-256(hostname + MAC address + PostgreSQL port)`. Copy `.enc` file to another machine → decrypt fails (different hostname/MAC/port). Port is a secret only พี่ช้าง knows, adding a layer even if hostname+MAC are discoverable.
- **Files:** `server/utils/machine-crypto.ts` (encrypt/decrypt), `server/config-bootstrap.ts` (startup resolver).
- **Startup flow on target machine:** Read `MACHINE_NAME` from `.env` → read `./config/etax-config.enc` → derive key from `os.hostname()` + first non-internal MAC → decrypt → get config DB connection string → connect → read all other credentials.
- **Startup flow on Replit:** Detect `REPL_ID` env var → use `DATABASE_URL` directly (no `.enc` file needed).
- **API endpoints:** `POST /api/platform/machines/generate-config` (generate encrypted config + credentials), `POST /api/platform/machines/test-decrypt` (verify).
- **Frontend:** "สร้าง Encryption Key" section on database-servers page — enter target hostname + MAC → get encrypted file + PostgreSQL credentials to set up on target.
- **Schema note:** `machines` table added to `shared/schema.ts` — requires `db:push` on deep-main when deploying.
- **Status:** Backend + frontend complete, tested encrypt/decrypt round-trip. พี่ช้าง still deciding final deployment strategy (pg_hba.conf trust vs encrypted file for aaPanel Linux servers). Conversation paused — พี่ช้าง went out, will continue later.

## Deployment Scripts (scripts/)
- **`scripts/etaxerp-deploy-prepare.sh`**: Full deployment preparation script for worst-case full-codebase deploy to etaxerp. Generates `deploy-package/` with SQL exports, .env template, and checklist.
- **`scripts/etaxerp-health-check.sh`**: Post-deployment health check. Run on etaxerp to verify endpoints, DB connection, required files, and env vars. Usage: `bash scripts/etaxerp-health-check.sh http://localhost:5000`
- **`deploy-package/`**: Output directory (gitignored, contains secrets). Has `DEPLOY-CHECKLIST.md`, SQL scripts for system_config, `.env.etaxerp` template, and host binding fix helper.

## Future Roadmap (Planned but not yet built)

### Accountant Invitation System (Email-based Cross-Tenant Access)
- **Concept:** Business owners invite accountants by email (like Xero/PEAK model). If multiple companies invite the same email, the accountant logs in once and sees all companies they've been invited to, switching between them freely.
- **Flow:** Owner clicks "เชิญนักบัญชี" → enters email → system sends invitation email → accountant clicks link → registers/logs in → accepts → sees the company in their list. Multiple companies can invite the same email.
- **Key Requirements:**
  - `accountant_invitations` table (email, companyId, status, invitedBy, invitedAt, acceptedAt)
  - Cross-tenant company visibility (accountant sees companies from different tenants)
  - "เชิญนักบัญชี" button in company settings
  - Invitation acceptance page (register or login + auto-link)
  - Owner can revoke access at any time
  - Single login for accountant, switch between all invited companies
- **Priority:** Phase 2 — after core POS/eTax features stabilize
- **Status:** Concept approved by owner, not yet started

## File Storage
- **Local Filesystem:** All uploaded files (logos, signatures, LINE documents, slips, work board files, firm documents, PDF imports, etc.) are stored in `{cwd}/uploads/` directory using `saveBufferLocally()` and `saveBufferToPath()` from `server/replit_integrations/object_storage/routes.ts`. Custom path via `UPLOAD_DIR` env var. Works on any OS (Linux, Windows). No dependency on any cloud/proprietary storage — purely local disk.
- **Storage utility functions:** `saveBufferLocally(buffer, contentType, originalName)` → UUID-named flat file; `saveBufferToPath(buffer, relativePath)` → organized subdirectory; `readFromPath(relativePath)` → read; `deleteFromPath(relativePath)` → delete; `getFullLocalPath(relativePath)` → absolute path.

## External Dependencies
- **LINE Messaging API:** Used for sending messages and processing webhooks.
- **Resend (Email Service):** Sends e-Tax Invoice emails with PDF/A-3 attachments, document sharing, and HR payslips.
- **OpenAI Vision API:** Powers AI-based slip verification for Facebook Chat Orders.
- **Google Gemini AI:** Dual AI document extraction — sends documents to both OpenAI GPT-4o and Gemini 2.5 Flash in parallel, scores results by completeness (vendor name, tax ID, items, amounts), and automatically picks the better result. Frontend shows which AI was chosen (🤖 badge). Falls back to whichever AI is available if only one is configured.