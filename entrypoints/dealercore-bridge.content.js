import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import {
  DEALERCORE_CONFIG,
  isDealerCoreHostname,
  tokenKeyFor,
} from '@/utils/dealercore-config';
import { fromDealerCoreVehicle, appendVehicles } from '@/utils/default-items';

export const DC_MESSAGE_SOURCE = 'DEALERCORE_FB_EXTENSION';
export const DC_MESSAGE_TYPE = 'STOCK_FOR_ADVERTISING';

async function silentHandshake(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/v1/auth/handshake`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: DEALERCORE_CONFIG.CLIENT_ID }),
    });
    if (res.status === 401) return { ok: false, unauthenticated: true };
    if (!res.ok) return { ok: false };
    const data = await res.json();
    if (!data?.status || !(data.token || data.access_token)) return { ok: false };
    const token = data.token || data.access_token;
    await browser.storage.local.set({
      dealercore_base_url: baseUrl,
      [tokenKeyFor(baseUrl)]: token,
      dealercore_session: {
        user: data.user ?? null,
        dealer: data.dealer ?? null,
        branch: data.branch ?? null,
        branches: data.branches ?? [],
        savedAt: Date.now(),
      },
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

async function ingestStockEvent(vehicle) {
  const mapped = fromDealerCoreVehicle(vehicle);
  if (!mapped) return { ok: false, error: 'Unusable vehicle payload.' };
  const stored = await browser.storage.local.get(['items']);
  const base = Array.isArray(stored.items) ? stored.items : [];
  // Upsert by DealerCore id so re-sent "update" events don't duplicate.
  const idx = base.findIndex(
    (it) => it.dealerCoreId === mapped.dealerCoreId && mapped.dealerCoreId != null,
  );
  let merged;
  if (idx >= 0) {
    // UPDATE_POLICY: 're-publish' (default) — replace stored copy so the next
    // automation run publishes the fresh details. To SKIP already-synced
    // vehicles instead, change this block to keep the old entry, e.g.:
    //   merged = base; // skip — keep existing, ignore incoming update
    // and optionally surface a "skipped" count in the UI.
    merged = [...base];
    merged[idx] = { ...merged[idx], ...mapped, id: merged[idx].id };
  } else {
    merged = appendVehicles(base, [mapped]);
  }
  await browser.storage.local.set({ items: merged });
  try {
    await browser.runtime.sendMessage({ action: 'TRIGGER_MARKETPLACE_SYNC', vehicle: mapped });
  } catch {
    // Background may not be listening (e.g. sidepanel closed) — storage is source of truth.
  }
  return { ok: true, total: merged.length, updated: idx >= 0 };
}

export default defineContentScript({
  matches: [
    'https://dealercore.com.au/*',
    'https://*.dealercore.com.au/*',
    'http://*.test/*',
    'http://localhost/*',
  ],
  async main() {
    const baseUrl = window.location.origin;
    await browser.storage.local.set({ dealercore_base_url: baseUrl });
    // Fire-and-forget: never block page load on handshake.
    silentHandshake(baseUrl);

    window.addEventListener('message', async (event) => {
      // Strict origin check per auth-guide §4 + §7.3.
      if (event.origin !== window.location.origin) return;
      if (!isDealerCoreHostname(window.location.hostname)) return;
      const data = event.data;
      if (!data || data.source !== DC_MESSAGE_SOURCE) return;
      if (data.type !== DC_MESSAGE_TYPE) return;
      try {
        await ingestStockEvent(data.payload);
      } catch (err) {
        console.error('[dealercore] STOCK_FOR_ADVERTISING ingest failed:', err);
      }
    });
  },
});
