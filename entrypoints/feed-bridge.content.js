import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { DEFAULT_ITEMS, toDealerCoreVehicle } from '@/utils/default-items';

export const FEED_MESSAGE_SOURCE = 'FB_AUTOMATOR_FEED';
export const FEED_MESSAGE_TYPE = 'FB_AUTOMATOR_ADD_VEHICLES';

// file:// pages report origin "null" — allow it plus local dev servers only.
const ALLOWED_ORIGINS = new Set([
  'null',
  'file://',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    const isLocalhost =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    return isLocalhost && isHttp;
  } catch {
    return false;
  }
}

function coerceToArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') return [payload];
  return null;
}

async function handleFeedMessage(rawItems) {
  const incoming = coerceToArray(rawItems);
  if (!incoming) return { ok: false, error: 'Payload must be an object or array of objects.' };

  // The worklist lives in the extension's IndexedDB; this page-origin script
  // reaches it through the background worker. Flat feed entries round-trip
  // through the inverse mapper so they share the store with API vehicles.
  const current = await browser.runtime.sendMessage({ type: 'GET_VEHICLES' });
  let total = Array.isArray(current?.vehicles) ? current.vehicles.length : 0;

  // Preserve the old "seed from DEFAULT_ITEMS on an empty store" behaviour.
  if (total === 0) {
    const seeds = DEFAULT_ITEMS.map(toDealerCoreVehicle).filter(Boolean);
    if (seeds.length) {
      await browser.runtime.sendMessage({ type: 'SYNC_VEHICLES', payload: seeds });
      total = seeds.length;
    }
  }

  const rows = incoming.map(toDealerCoreVehicle).filter(Boolean);
  let added = 0;
  if (rows.length) {
    const res = await browser.runtime.sendMessage({ type: 'SYNC_VEHICLES', payload: rows });
    if (!res?.success) throw new Error(res?.error || 'Local vehicle sync failed');
    added = res.added ?? rows.length;
    total += res.count ?? rows.length;
  }
  return { ok: true, added, total };
}

export default defineContentScript({
  // Injected into the local test page (index.html), NOT facebook.com.
  // Enable "Allow access to file URLs" in chrome://extensions for file:// testing,
  // or serve index.html via Live Server (http://127.0.0.1:5500).
  matches: ['file:///*', 'http://localhost/*', 'http://127.0.0.1/*'],
  async main() {
    window.addEventListener('message', async (event) => {
      const data = event.data;
      if (!data || data.source !== FEED_MESSAGE_SOURCE) return;
      if (data.type !== FEED_MESSAGE_TYPE) return;
      if (!isAllowedOrigin(event.origin)) {
        console.warn('[fb-automator] Rejected feed from disallowed origin:', event.origin);
        return;
      }

      try {
        const result = await handleFeedMessage(data.items ?? data.payload);
        // Ack back to the page so index.html can show "appended N items".
        window.postMessage(
          {
            source: FEED_MESSAGE_SOURCE,
            type: 'FB_AUTOMATOR_FEED_RESULT',
            ...result,
          },
          '*',
        );
        console.log(`[fb-automator] Feed ingested: +${result.added} (total ${result.total})`);
      } catch (err) {
        console.error('[fb-automator] Feed ingest failed:', err);
        window.postMessage(
          { source: FEED_MESSAGE_SOURCE, type: 'FB_AUTOMATOR_FEED_RESULT', ok: false, error: String(err) },
          '*',
        );
      }
    });
  },
});
