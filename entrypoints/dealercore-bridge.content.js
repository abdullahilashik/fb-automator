import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import {
  DEALERCORE_CONFIG,
  isDealerCoreHostname,
  isLoopbackHostname,
  tokenKeyFor,
} from '@/utils/dealercore-config';

export const DC_MESSAGE_SOURCE = 'DEALERCORE_FB_EXTENSION';
export const DC_MESSAGE_TYPE = 'STOCK_FOR_ADVERTISING';

async function silentHandshake(baseUrl, { force = false } = {}) {
  try {
    // Respect an explicit sign-out: don't re-acquire a token until the user
    // connects again from the sidepanel. `force` is that explicit action.
    if (!force) {
      const { dealercore_signed_out: signedOut } = await browser.storage.local.get([
        'dealercore_signed_out',
      ]);
      if (signedOut) return { ok: false, signedOut: true };
    }

    const payload = DEALERCORE_CONFIG.HANDSHAKE_SEND_CLIENT_ID
      ? { client_id: DEALERCORE_CONFIG.CLIENT_ID }
      : {};
    const res = await fetch(`${baseUrl}/api/v1/auth/handshake`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 429) {
      // Throttled at 30/min (guide §8). The bridge auto-handshakes on every
      // page load, so this is easy to trip; report it instead of pretending
      // the user is simply signed out.
      return { ok: false, rateLimited: true };
    }
    if (res.status === 401) {
      await browser.storage.local.remove([tokenKeyFor(baseUrl)]);
      return { ok: false, unauthenticated: true };
    }
    if (!res.ok) return { ok: false };
    const data = await res.json();
    if (!data?.status || !(data.token || data.access_token)) return { ok: false };
    const token = data.token || data.access_token;
    await browser.storage.local.set({
      dealercore_base_url: baseUrl,
      // Proof this loopback origin really answered as DealerCore; without it
      // the sidepanel refuses a localhost base (see getDealerCoreBaseUrl).
      dealercore_base_trusted: true,
      dealercore_signed_out: false,
      [tokenKeyFor(baseUrl)]: token,
      dealercore_session: {
        user: data.user ?? null,
        dealer: data.dealer ?? null,
        branch: data.branch ?? null,
        branches: data.branches ?? [],
        savedAt: Date.now(),
      },
    });
    try {
      await browser.runtime.sendMessage({ action: 'DEALERCORE_SESSION_READY', baseUrl });
    } catch {
      // Sidepanel may be closed; storage remains the source of truth.
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

async function ingestStockEvent(vehicle) {
  if (!vehicle || typeof vehicle !== 'object') {
    return { ok: false, error: 'Unusable vehicle payload.' };
  }
  // This script runs on the DealerCore page origin, so it cannot write the
  // extension's IndexedDB directly. The background upserts into Dexie, which
  // is now the single source of truth for the vehicle worklist.
  try {
    const response = await browser.runtime.sendMessage({
      type: 'SAVE_SINGLE_VEHICLE',
      payload: vehicle,
    });
    return { ok: response?.success ?? false, error: response?.error, id: response?.id };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export default defineContentScript({
  matches: [
    'https://dealercore.com.au/*',
    'https://*.dealercore.com.au/*',
    'http://*.test/*',
    'http://localhost/*',
  ],
  async main() {
    // The sidepanel can inject this file on demand (see ensureBridgeInjected in
    // dealercore-api.js) because Chrome never injects statically declared
    // content scripts into tabs that predate the extension load. Registering
    // the listeners twice would make every runtime.sendMessage resolve ambiguously,
    // so bail out if this tab is already wired up.
    if (window.__DC_BRIDGE_READY__) return;
    window.__DC_BRIDGE_READY__ = true;

    const baseUrl = window.location.origin;
    // Loopback origins are not trusted on sight: any localhost dev server would
    // otherwise hijack the base URL. `silentHandshake` persists a loopback
    // origin only if it actually answers as DealerCore. Strong hostnames
    // (dealercore.com.au / *.test) are cached immediately.
    if (!isLoopbackHostname(window.location.hostname)) {
      await browser.storage.local.set({
        dealercore_base_url: baseUrl,
        dealercore_base_trusted: true,
      });
    }
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
        const result = await ingestStockEvent(data.payload);
        // Publication Automation: let the background start the run when the
        // sidepanel is closed and the user chose "Publish immediately".
        if (result.ok && result.id != null) {
          browser.runtime
            .sendMessage({ type: 'AUTO_PUBLISH', ids: [result.id] })
            .catch(() => {});
        }
      } catch (err) {
        console.error('[dealercore] STOCK_FOR_ADVERTISING ingest failed:', err);
      }
    });

    // Explicit "Use my active session" from the sidepanel. Runs the handshake
    // here (same-origin, so the session cookie is sent) and bypasses the
    // signed-out guard, because the user just asked to connect.
    browser.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request?.action === 'DC_RUN_HANDSHAKE') {
        silentHandshake(window.location.origin, { force: true }).then(sendResponse);
        return true;
      }
      return false;
    });
  },
});
