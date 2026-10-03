import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { toDealerCoreVehicle } from '@/utils/default-items';
import { clearDealerCoreSession, getAccessToken } from '@/utils/dealercore-api';
import {
  PUBLICATION_MODE,
  getPublicationMode,
} from '@/utils/publication-settings';

// Dexie (IndexedDB) is the source of truth for the vehicle worklist.
import { db } from '@/utils/db';

/**
 * Content scripts (facebook.com / dealercore.com.au) run against the *page*
 * origin, so they can never see the extension's IndexedDB. Every vehicle read
 * or write therefore funnels through these background handlers.
 */

// Assign sequential numeric ids to rows that lack one (synthetic feed/test
// payloads). API responses always carry their own `id`.
async function assignMissingIds(rows) {
  const missing = rows.filter((r) => !Number.isFinite(Number(r?.id)));
  if (missing.length === 0) return rows;
  let max = 0;
  const existing = await db.vehicles.toArray();
  for (const v of existing) max = Math.max(max, Number(v.id) || 0);
  for (const row of missing) {
    max += 1;
    row.id = max;
  }
  return rows;
}

// One-time lift of the pre-Dexie storage.local `items` array into IndexedDB.
// Legacy entries are flat automation items, so they round-trip through the
// inverse mapper. Storage is cleared whether or not anything was imported so
// the old key stops mattering.
async function migrateLegacyItems() {
  const { items } = await browser.storage.local.get(['items']);
  if (Array.isArray(items) && items.length) {
    try {
      const rows = items.map(toDealerCoreVehicle).filter(Boolean);
      if (rows.length) {
        await db.vehicles.bulkPut(await assignMissingIds(rows));
      }
    } catch (error) {
      console.error('[fb-automator] Legacy items migration failed:', error);
    }
  }
  await browser.storage.local.remove(['items']);
}

// ── Publication Automation (auto-publish) ──
// Content scripts emit AUTO_PUBLISH after ingesting a postMessage stock/feed
// event. The background decides whether to start immediately, queue behind a
// running automation, or skip (not connected) — the sidepanel need not be open.
const TARGET_URL = 'https://www.facebook.com/marketplace/create/vehicle';
const PENDING_AUTO_KEY = 'pendingAutoPublish';
const AUTO_NOTICE_KEY = 'automation_notice';

async function isRunInProgress() {
  const { runQueueIds, automation_state } = await browser.storage.local.get([
    'runQueueIds',
    'automation_state',
  ]);
  if (!Array.isArray(runQueueIds) || runQueueIds.length === 0) return false;
  const phase = automation_state?.phase;
  return phase !== 'complete' && phase !== 'cancelled';
}

// Auto mode is only allowed to run unattended when both sides are ready.
async function checkAutoPublishReady() {
  try {
    const cookie = await browser.cookies.get({
      url: 'https://www.facebook.com',
      name: 'c_user',
    });
    if (!cookie?.value) return { ok: false, reason: 'Facebook is not signed in.' };
  } catch {
    return { ok: false, reason: 'Could not read the Facebook session.' };
  }
  try {
    const { token } = await getAccessToken();
    if (!token) return { ok: false, reason: 'DealerCore is not connected.' };
  } catch {
    return { ok: false, reason: 'DealerCore is not connected.' };
  }
  return { ok: true };
}

async function notifyAutoSkip(message) {
  try {
    await browser.storage.local.set({
      [AUTO_NOTICE_KEY]: { level: 'warn', message, at: Date.now() },
    });
    await browser.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    await browser.action.setBadgeText({ text: '!' });
  } catch {
    // Badge/notice are best-effort.
  }
  console.warn('[fb-automator] Auto-publish skipped:', message);
}

// Write the run queue the content script consumes, then hand it a create tab:
// reuse an existing one, otherwise open one so the run is truly hands-off.
async function dispatchRun(ids, mode = 'publish') {
  await browser.storage.local.set({
    runQueueIds: ids,
    currentIndex: 0,
    results: [],
    automation_state: { phase: 'running', cancelRequested: false, mode },
  });
  try {
    await browser.action.setBadgeText({ text: '' });
  } catch {
    // no-op
  }

  const pattern = 'https://www.facebook.com/marketplace/create/*';
  let tabId = null;
  try {
    const tabs = await browser.tabs.query({ url: pattern });
    if (tabs[0]?.id != null) tabId = tabs[0].id;
  } catch {
    // Fall through to creating a tab.
  }

  if (tabId != null) {
    try {
      const res = await browser.tabs.sendMessage(tabId, {
        action: 'START_AUTOMATION',
        mode,
      });
      if (res?.status) return;
    } catch {
      // No receiver yet (tab predates the extension): reloading re-runs init().
    }
    await browser.tabs.update(tabId, { url: TARGET_URL });
    return;
  }

  await browser.tabs.create({ url: TARGET_URL, active: true });
}

async function enqueuePendingAuto(ids) {
  const stored = await browser.storage.local.get([PENDING_AUTO_KEY]);
  const pending = new Set(Array.isArray(stored[PENDING_AUTO_KEY]) ? stored[PENDING_AUTO_KEY] : []);
  for (const id of ids) pending.add(id);
  await browser.storage.local.set({ [PENDING_AUTO_KEY]: [...pending] });
}

async function runAutoPublish(rawIds) {
  const ids = [
    ...new Set(
      (Array.isArray(rawIds) ? rawIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id)),
    ),
  ];
  if (!ids.length) return;
  if ((await getPublicationMode()) !== PUBLICATION_MODE.AUTO) return;

  if (await isRunInProgress()) {
    await enqueuePendingAuto(ids);
    return;
  }
  const ready = await checkAutoPublishReady();
  if (!ready.ok) {
    await notifyAutoSkip(ready.reason);
    return;
  }
  await dispatchRun(ids, 'publish');
}

// Serialise concurrent AUTO_PUBLISH bursts within one worker lifetime.
let autoChain = Promise.resolve();
function handleAutoPublish(ids) {
  autoChain = autoChain.then(() => runAutoPublish(ids)).catch(() => {});
  return autoChain;
}

// After any run ends, start whatever accumulated while it was busy.
let draining = false;
async function drainPendingAuto() {
  if (draining) return;
  const stored = await browser.storage.local.get([PENDING_AUTO_KEY]);
  const pending = Array.isArray(stored[PENDING_AUTO_KEY])
    ? stored[PENDING_AUTO_KEY]
    : [];
  if (!pending.length) return;
  if (await isRunInProgress()) return;
  if ((await getPublicationMode()) !== PUBLICATION_MODE.AUTO) {
    await browser.storage.local.remove([PENDING_AUTO_KEY]);
    return;
  }
  const ready = await checkAutoPublishReady();
  if (!ready.ok) {
    await browser.storage.local.remove([PENDING_AUTO_KEY]);
    await notifyAutoSkip(ready.reason);
    return;
  }
  draining = true;
  try {
    await browser.storage.local.remove([PENDING_AUTO_KEY]);
    await dispatchRun(pending, 'publish');
  } finally {
    draining = false;
  }
}

export default defineBackground(() => {
  if (browser.sidePanel) {
    browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => { });
  }
  migrateLegacyItems();
  // Resume anything queued while the worker was asleep.
  drainPendingAuto();

  // Auto-publish waits for any in-flight run; start the queued batch when the
  // queue empties or the run reports completion.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const runQueue = changes.runQueueIds;
    const emptied =
      runQueue &&
      (!Array.isArray(runQueue.newValue) || runQueue.newValue.length === 0);
    const phase = changes.automation_state?.newValue?.phase;
    if (emptied || phase === 'complete' || phase === 'cancelled') {
      drainPendingAuto();
    }
  });

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      if (request.action === 'NAVIGATE_TO_CREATE') {
        await browser.tabs.update(sender.tab.id, {
          url: 'https://www.facebook.com/marketplace/create/vehicle',
        });
        sendResponse({ status: 'navigating' });
        return;
      }
      if (request.action === 'DEALERCORE_LOGOUT') {
        await clearDealerCoreSession();
        sendResponse({ status: 'logged-out' });
        return;
      }

      // Publication Automation: a postMessage stock/feed event arrived. Decide
      // whether to auto-start, queue behind the current run, or skip. Fire and
      // forget so the content script's ingest ack is never held up.
      if (request.type === 'AUTO_PUBLISH') {
        handleAutoPublish(request.ids);
        sendResponse({ status: 'accepted' });
        return;
      }

      // Dexie: bulk-insert all vehicles from a full §5 API sync.
      if (request.type === 'SYNC_VEHICLES') {
        try {
          const before = new Map(
            (await db.vehicles.toArray()).map((v) => [v.id, v]),
          );
          const rows = await assignMissingIds(request.payload);
          await db.vehicles.bulkPut(rows);
          const after = new Map(
            (await db.vehicles.toArray()).map((v) => [v.id, v]),
          );
          let added = 0;
          let updated = 0;
          for (const [id, v] of after) {
            if (!before.has(id)) added += 1;
            else if (JSON.stringify(before.get(id)) !== JSON.stringify(v)) {
              updated += 1;
            }
          }
          sendResponse({
            success: true,
            count: rows.length,
            added,
            updated,
            ids: rows.map((r) => r.id),
          });
        } catch (error) {
          console.error(`Failed to sync vehicles to indexed db: ${error}`);
          sendResponse({ success: false, error: String(error) });
        }
        return;
      }

      // Dexie: upsert a single vehicle.
      if (request.type === 'SAVE_SINGLE_VEHICLE') {
        try {
          const [row] = await assignMissingIds([request.payload]);
          const id = await db.vehicles.put(row);
          sendResponse({ success: true, id });
        } catch (error) {
          console.error(`Failed to SAVE_SINGLE_VEHICLE for: ${error}`);
          sendResponse({ success: false, error: String(error) });
        }
        return;
      }

      // Dexie: apply a partial patch (e.g. facebook post_id after publishing).
      if (request.type === 'UPDATE_VEHICLES') {
        try {
          const modified = await db.vehicles
            .where('id')
            .equals(request.payload.id)
            .modify(request.payload);
          sendResponse({ success: true, modified });
        } catch (error) {
          console.error(`Failed to UPDATE_VEHICLES for: ${error}`);
          sendResponse({ success: false, error: String(error) });
        }
        return;
      }

      // Dexie: read the whole vehicle list (used by content scripts and the
      // sidepanel; extension-origin contexts may also query `db` directly).
      if (request.type === 'GET_VEHICLES') {
        try {
          const vehicles = await db.vehicles.toArray();
          sendResponse({ success: true, vehicles });
        } catch (error) {
          console.error(`Failed to read vehicles: ${error}`);
          sendResponse({ success: false, error: String(error) });
        }
        return;
      }

      // Dexie: remove one vehicle from the local mirror.
      if (request.type === 'DELETE_VEHICLE') {
        try {
          const id = Number(request.id);
          if (!Number.isFinite(id)) throw new Error('Missing vehicle id');
          await db.vehicles.delete(id);
          sendResponse({ success: true, id });
        } catch (error) {
          console.error(`Failed to DELETE_VEHICLE for: ${error}`);
          sendResponse({ success: false, error: String(error) });
        }
        return;
      }

      // Dexie: wipe the local vehicle mirror.
      if (request.type === 'CLEAR_VEHICLES') {
        try {
          await db.vehicles.clear();
          sendResponse({ success: true });
        } catch (error) {
          console.error(`Failed to clear vehicles: ${error}`);
          sendResponse({ success: false });
        }
        return;
      }

      // Dexie: persist the outcome of a §6 write-back so the sidepanel can
      // identify per-vehicle sync state ('synced' | 'failed'). Nested
      // facebook + timestamps are merged so unrelated columns survive.
      if (request.type === 'UPDATE_SYNC_STATUS') {
        try {
          const { id, outcome, account_id, post_id, post_url, last_synced_at, message } =
            request.payload || {};
          const modified = await db.vehicles.where('id').equals(id).modify((v) => {
            if (outcome === 'synced') {
              return {
                facebook: {
                  account_id: account_id || v.facebook?.account_id || '',
                  post_id: post_id || v.facebook?.post_id || '',
                  post_url: post_url || v.facebook?.post_url || '',
                },
                timestamps: {
                  ...(v.timestamps || {}),
                  last_synced_at:
                    last_synced_at ||
                    v.timestamps?.last_synced_at ||
                    new Date().toISOString(),
                },
                sync_status: 'synced',
                sync_error: null,
              };
            }
            return { sync_status: 'failed', sync_error: message || null };
          });
          sendResponse({ success: true, modified });
        } catch (error) {
          console.error(`Failed to UPDATE_SYNC_STATUS for: ${error}`);
          sendResponse({ success: false, error: String(error) });
        }
        return;
      }

      // Image download for the photo upload step. Content scripts are subject
      // to the page's CORS policy, so public S3 buckets that omit
      // Access-Control-Allow-Origin break the plain fetch in handlePhotos().
      // The background can bypass that once it holds host permission for the
      // image origin (requested on demand via optional_host_permissions).
      if (request.type === 'FETCH_IMAGE') {
        const fetchBytes = async (url) => {
          const resp = await fetch(url, { credentials: 'omit' });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return {
            bytes: await resp.arrayBuffer(),
            contentType: resp.headers.get('content-type') || 'image/jpeg',
          };
        };
        try {
          const { bytes, contentType } = await fetchBytes(request.url);
          sendResponse({ success: true, bytes, contentType });
        } catch (firstError) {
          try {
            const origin = new URL(request.url).origin;
            const granted = await browser.permissions.request({
              origins: [`${origin}/*`],
            });
            if (!granted) throw firstError;
            const { bytes, contentType } = await fetchBytes(request.url);
            sendResponse({ success: true, bytes, contentType });
          } catch (secondError) {
            console.error(`Image fetch failed (background): ${secondError}`);
            sendResponse({
              success: false,
              error: String(secondError?.message || secondError),
            });
          }
        }
        return;
      }

      sendResponse({ status: 'ignored' });
    })();
    // keep the message line open for async sendResponse
    return true;
  });
});