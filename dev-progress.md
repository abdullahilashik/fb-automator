## Stage 1 — Done so far

**A. Foundation / data layer**
- Dexie (`utils/db.ts`) as single source of truth; background is the only IndexedDB gateway via messages. To put it simply we've implemented IndexedDB database to get a hold of our synced inventories. An auto cleanup has been implemented that will automatically remove the old / obsoluete inventories from the local database.

- When extension is loaded first time it will automatically call the sync api to get a fresh copy of the latest data if available. After that in order to get the latest data extension relies on window.postMessage and manual sync button click as per discussion.

**B. DealerCore integration (contract from `auth-guide.md`)**
- Dual auth: Flow B silent handshake (`connectViaSession`) default, Flow A first-party OAuth+PKCE fallback (`launchOAuthLogin` → `fetchMe`).
- Per-origin token storage (`token_<origin>`), loopback trust (`TRUSTED_BASE_KEY`/`saveTrustedBase`), `dealercore-config.js` hostname helpers.
- Sync: `fetchAllVehicles` + `syncFromDealerCore({quiet})`, freshness window `INVENTORY_FRESH_MS`, signed-image refresh.


**C. Facebook automation**
- FB content script (`entrypoints/content/index.js`): form-fill pipeline, phase reporting, cancel watcher, `START_AUTOMATION` listener.
- Field handlers (`utils/handle-form-field.js`, `find-label-by.js`, `input-simulation.js`, `sleep.js`), `selection.md` selectors.
- Publish success path: `extractListingIdAfterPublish`/`extractPostInfo`/`reportSync`, image expiry fix, publish-stall fix.
- User can Select Automatically Publish to facebook marketplace as soon as the new data arrives or manually publish data by clicking 'Publish' button.
- After the vehicle is published extension extract the published item's id and sends that back to dealercore as acknowledgemenet. We can track / find or later edit using this ID.

**D. UI**
- Sidepanel shell, Listing page (sync badges, select, Publish, Save draft, Retry, per-card ×), Settings, AuthModal, NotConnected, BugPage.
- Publication Automation setting (manual/auto) + background auto-worker orchestration.

**F. Docs**: `readme.md`, `auth-guide.md`, `selection.md`, `report-a-bug.md`, `docs/index.html` (+ validator passing).

## Stage 2 — Remaining to develop / add

- Confirm the "publish immediately" auto path end-to-end against a live DealerCore event.
- Update/sync resilience: retry/idempotency on write-back; de-dup edge cases across bridge vs API.
- Status workflow gaps: define full lifecycle (pending → publishing → published → synced/failed) across UI + DealerCore mirror.

## Stage 3 — UX improvements (proposals)
- Clear progress/toast per selected item; better empty/loading states.
- Batch controls (select all / by status), filters for pending vs posted.
- Surface sync errors inline with actionable retry; clearer auto-mode feedback when sidepanel is closed.
- Onboarding/diagnostics: guided auth troubleshooting, surfaced diagnostics.
- Accessibility + keyboard nav; consistent dark mode; virtualized list for large inventories.