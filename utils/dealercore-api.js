import { browser } from 'wxt/browser';
import {
  DEALERCORE_CONFIG,
  isDealerCoreHostname,
  tokenKeyFor,
} from '@/utils/dealercore-config';

export function normalizeBaseUrl(raw) {
  const fallback = DEALERCORE_CONFIG.DEFAULT_DOMAIN;
  try {
    const url = new URL(raw || fallback);
    return url.origin;
  } catch {
    return fallback;
  }
}

export async function getDealerCoreBaseUrl() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const url = new URL(tab.url);
      if (isDealerCoreHostname(url.hostname)) {
        await browser.storage.local.set({ dealercore_base_url: url.origin });
        return url.origin;
      }
    }
  } catch {
    // Fall through to cache/default.
  }
  const stored = await browser.storage.local.get(['dealercore_base_url']);
  return normalizeBaseUrl(stored.dealercore_base_url);
}

export async function getAccessToken(baseUrl) {
  const base = baseUrl || (await getDealerCoreBaseUrl());
  const stored = await browser.storage.local.get([tokenKeyFor(base)]);
  return { base, token: stored[tokenKeyFor(base)] || null };
}

function redirectUri() {
  // chrome.identity redirect: https://<extension-id>.chromiumapp.org/
  const id = browser?.runtime?.id || '<extension-id>';
  return `https://${id}.chromiumapp.org${DEALERCORE_CONFIG.REDIRECT_PATH}`;
}

export function getRedirectUri() {
  return redirectUri();
}

export function assertClientConfigured() {
  if (!DEALERCORE_CONFIG.CLIENT_ID || DEALERCORE_CONFIG.CLIENT_ID === 'YOUR_FIRST_PARTY_CLIENT_ID_TEST') {
    throw new Error(
      'OAuth CLIENT_ID is not set. Open utils/dealercore-config.js and paste the First-Party client ID from Nova → Integrations → OAuth Clients.',
    );
  }
}

function b64urlBytes(bytes) {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createPkce() {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(64));
  const verifier = b64urlBytes(verifierBytes);
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then((hash) => ({
    verifier,
    challenge: b64urlBytes(new Uint8Array(hash)),
  }));
}

export function buildAuthorizeUrl(base, challenge) {
  const origin = normalizeBaseUrl(base);
  const params = {
    client_id: DEALERCORE_CONFIG.CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  };
  // Only send `scope` when configured — an empty `scope=` can trip strict
  // server-side scope validation and mask the real error.
  if (DEALERCORE_CONFIG.SCOPE) params.scope = DEALERCORE_CONFIG.SCOPE;
  return `${origin}/oauth/authorize?${new URLSearchParams(params).toString()}`;
}

export async function openAuthInTab(base) {
  assertClientConfigured();
  const origin = normalizeBaseUrl(base);
  const { challenge } = await createPkce();
  // NOTE: PKCE verifier is not persisted for the tab flow — this is a
  // diagnostic fallback so you can see the real server error page.
  // Complete login via the popup button once the server side is fixed.
  const url = buildAuthorizeUrl(origin, challenge);
  await browser.tabs.create({ url });
  return url;
}

/**
 * Pre-flight the authorize URL so we can report the server's real answer.
 * Chrome's launchWebAuthFlow collapses every failure (401, 404, blocked
 * navigation) into "Authorization page could not be loaded.", which hides
 * the cause. Probing first gives an actionable message.
 */
export async function probeAuthorize(base, challenge) {
  const url = buildAuthorizeUrl(base, challenge);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      credentials: 'omit',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    // The server answers a bad client with JSON, not HTML — keep it so the
    // UI can quote the real reason instead of guessing.
    const raw = await res.text().catch(() => '');
    let error = null;
    try {
      const parsed = JSON.parse(raw);
      error = { error: parsed.error, description: parsed.error_description };
    } catch {
      /* non-JSON body (login page / HTML error) */
    }
    return {
      ok: res.status < 400,
      status: res.status,
      location: res.headers.get('location'),
      contentType: res.headers.get('content-type'),
      error,
      url,
    };
  } catch (e) {
    return { ok: false, status: 0, error: String(e?.message || e), url };
  }
}

export function explainProbe(probe) {
  const clientId = DEALERCORE_CONFIG.CLIENT_ID;
  if (probe.status === 0) {
    return `Could not reach ${probe.url} — check VPN/network. (${probe.error || 'no response'})`;
  }
  if (probe.status === 401 || probe.status === 403) {
    // Only blame client registration when the server actually returned the
    // OAuth error envelope. A bare 401 (no `error` field) is usually Laravel
    // rejecting the request on content negotiation: this endpoint answers
    // 302 for any HTML-ish Accept but 401 for `Accept: application/json`.
    if (!probe.error?.error) {
      return (
        `HTTP ${probe.status} with no OAuth error body. This is usually not a ` +
        `client-registration problem: /oauth/authorize is a browser navigation ` +
        `endpoint and returns 401 when requested with Accept: application/json. ` +
        `Re-test by clicking "Test Flow A", which opens a real browser tab.`
      );
    }
    const code = probe.error?.error ? ` Server said "${probe.error.error}": ${probe.error.description}.` : '';
    return (
      `Server rejected the authorize request (HTTP ${probe.status}) for client_id ${clientId}.${code} ` +
      `Verify in Nova → Integrations → OAuth Clients that this exact UUID is First Party, ` +
      `active, has the Authorization Code grant, and lists the redirect URI ` +
      `${redirectUri()} (note the trailing slash).`
    );
  }
  if (probe.status === 404) {
    return `HTTP 404 — /oauth/authorize does not exist on this origin. Check whether DealerCore mounts OAuth under a different path.`;
  }
  if (probe.status >= 300 && probe.status < 400) {
    return `Server redirected to ${probe.location} (expected /login for a guest session).`;
  }
  return `Authorize endpoint responded HTTP ${probe.status} — unexpected for a document request.`;
}

/** Probe the endpoints the extension depends on. */
export async function diagnoseDealercore(base) {
  const origin = normalizeBaseUrl(base);
  const { challenge } = await createPkce();
  const probe = await probeAuthorize(origin, challenge);
  const results = [{ label: 'GET /oauth/authorize', status: probe.status, note: explainProbe(probe) }];

  const checks = [
    { label: 'GET /api/v1/auth/me', path: '/api/v1/auth/me' },
    { label: 'POST /api/v1/auth/handshake', path: '/api/v1/auth/handshake', method: 'POST' },
  ];
  for (const check of checks) {
    try {
      const res = await fetch(`${origin}${check.path}`, {
        method: check.method || 'GET',
        redirect: 'manual',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: check.method === 'POST' ? JSON.stringify({ client_id: DEALERCORE_CONFIG.CLIENT_ID }) : undefined,
      });
      results.push({
        label: check.label,
        status: res.status,
        note: res.status === 200 ? 'OK (session present)' : res.status === 401 ? '401 — no DealerCore session in this browser' : `HTTP ${res.status}`,
      });
    } catch (e) {
      results.push({ label: check.label, status: 0, note: String(e?.message || e) });
    }
  }
  return { origin, redirectUri: redirectUri(), results };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Find an open DealerCore tab for this origin.
 *
 * The automatic path must never hijack the user's window, so both
 * `createIfMissing` and `focus` can be disabled: the tab is then only borrowed,
 * never opened and never activated.
 */
async function ensureDealerCoreTab(base, { createIfMissing = true, focus = true } = {}) {
  const tabs = await browser.tabs.query({});
  const match = tabs.find((t) => {
    try {
      return new URL(t.url).origin === base;
    } catch {
      return false;
    }
  });
  if (match?.id != null) {
    if (focus) await browser.tabs.update(match.id, { active: true });
    return match.id;
  }
  if (!createIfMissing) return null;
  const created = await browser.tabs.create({ url: base, active: true });
  return created?.id ?? null;
}

/**
 * Locate the built bridge bundle from the manifest rather than hardcoding a
 * path, so a rename or a WXT output change doesn't silently break injection.
 */
function bridgeScriptFiles() {
  try {
    const manifest = browser.runtime.getManifest();
    const entry = (manifest.content_scripts || []).find((cs) =>
      (cs.js || []).some((f) => /dealercore-bridge/.test(f)),
    );
    const files = (entry?.js || []).filter((f) => /dealercore-bridge/.test(f));
    if (files.length) return files;
  } catch {}
  return ['content-scripts/dealercore-bridge.js'];
}

/**
 * Inject the handshake bridge into a tab that doesn't have it yet.
 *
 * This is what makes the silent path actually silent: Chrome only injects
 * statically declared content scripts into pages loaded *after* the extension,
 * so any DealerCore tab that was already open — the norm after a reload or an
 * update — has no receiver and the handshake fails with nothing to show for it.
 */
async function ensureBridgeInjected(tabId) {
  try {
    await browser.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: bridgeScriptFiles(),
    });
    return true;
  } catch {
    // Restricted page (chrome://, Web Store), or the host permission is gone.
    return false;
  }
}

/**
 * Flow B (auth-guide §3): connect using the user's active DealerCore session.
 * No OAuth client required.
 *
 * The handshake MUST run from a DealerCore page (same-origin) so the session
 * cookie is attached — a cross-site POST from the extension page would be
 * dropped by SameSite rules. So we drive the bridge content script instead of
 * fetching from here, and we do it on demand: this works even after an
 * explicit sign-out suppressed the automatic handshake.
 */
export async function connectViaSession({ openTabIfMissing = true, focus = true } = {}) {
  const base = await getDealerCoreBaseUrl();
  // Explicit user action: re-arm the automatic handshake.
  await browser.storage.local.set({ dealercore_signed_out: false });

  const tabId = await ensureDealerCoreTab(base, {
    createIfMissing: openTabIfMissing,
    focus,
  });
  if (tabId == null) {
    throw new Error(
      openTabIfMissing
        ? `Could not open a DealerCore tab for ${base}.`
        : `No open DealerCore tab for ${base}.`,
    );
  }

  // The bridge may not be present yet: it is a statically declared content
  // script, so Chrome skips tabs that were already open. Inject on the first
  // "no receiver" and retry immediately instead of stalling the spinner for
  // seconds before telling the user to refresh a tab they never knew about.
  let result = null;
  let injectTried = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      result = await browser.tabs.sendMessage(tabId, { action: 'DC_RUN_HANDSHAKE' });
    } catch {
      result = null; // no receiver yet
      if (!injectTried) {
        injectTried = true;
        if (await ensureBridgeInjected(tabId)) {
          await sleep(150); // let the message listener register
          continue;
        }
      }
    }
    if (result?.ok) break;
    if (result && result.unauthenticated) {
      throw new Error(
        `DealerCore reported no active session. Log in to ${base} in the tab that just opened (the main app, not /nova), then click this button again.`,
      );
    }
    await sleep(800);
  }

  if (!result?.ok) {
    // Last resort: the bridge may have completed the handshake but lost the
    // reply (e.g. tab reloaded mid-flight). Check storage before failing.
    const { token } = await getAccessToken(base);
    if (!token) {
      throw new Error(
        `Could not complete the handshake with ${base}. Make sure the page is fully loaded and you are signed in, then try again.`,
      );
    }
    return finalizeSession(base);
  }
  return finalizeSession(base);
}

/**
 * Silent, non-intrusive connection attempt. Runs automatically when the
 * sidepanel opens so the common case needs no button press.
 *
 * Deliberate constraints — this must never interrupt the user:
 *   - never opens a browser tab
 *   - never steals focus from the current tab
 *   - never falls back to interactive OAuth (a window with no user action)
 *   - honours an explicit sign-out
 *   - never throws; reports a reason instead
 *
 * A still-valid token short-circuits the handshake entirely.
 */
export async function tryAutoConnect() {
  try {
    const { dealercore_signed_out: signedOut } = await browser.storage.local.get([
      'dealercore_signed_out',
    ]);
    if (signedOut) return { ok: false, reason: 'Signed out.' };

    const base = await getDealerCoreBaseUrl();
    const { token } = await getAccessToken(base);
    if (token) {
      // Revalidate — a stale token must never read as "connected".
      try {
        const me = await fetchMe(base, token);
        // Refresh the cached snapshot while we're here: a token minted by the
        // Flow A button stores a minimal one, and nothing else would upgrade
        // it, so dealer/branch would stay blank in the header and Settings.
        await persistSessionSnapshot(base, me);
        return { ok: true, base, me, via: 'existing-token' };
      } catch {
        // Token is dead; fall through and mint a fresh one.
      }
    }

    const { base: usedBase, me } = await connectViaSession({
      openTabIfMissing: false,
      focus: false,
    });
    return { ok: true, base: usedBase, me, via: 'handshake' };
  } catch (e) {
    return { ok: false, reason: e?.message || String(e) };
  }
}

/**
 * Cache the session snapshot the sidepanel renders from. The token itself is
 * stored separately per-origin; this is purely a convenience copy.
 */
function persistSessionSnapshot(base, me) {
  return browser.storage.local.set({
    dealercore_signed_out: false,
    dealercore_session: {
      user: me?.user ?? null,
      dealer: me?.dealer ?? null,
      branch: me?.branch ?? null,
      branches: me?.branches ?? [],
      baseUrl: base,
      savedAt: Date.now(),
    },
  });
}

async function finalizeSession(base) {
  const { token } = await getAccessToken(base);
  if (!token) throw new Error('Handshake completed but no token was stored.');
  const me = await fetchMe(base, token);
  await persistSessionSnapshot(base, me);
  return { base, me };
}

export async function launchOAuthLogin(base) {
  assertClientConfigured();
  const origin = normalizeBaseUrl(base);
  const { verifier, challenge } = await createPkce();
  const authUrl = buildAuthorizeUrl(origin, challenge);

  const probe = await probeAuthorize(origin, challenge);
  if (!probe.ok && probe.status >= 400) {
    throw new Error(explainProbe(probe));
  }
  console.log('[dealercore] authorize URL:', authUrl);

  let redirected;
  try {
    redirected = await browser.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });
  } catch (e) {
    throw new Error(
      `Authorization page could not be loaded. Server pre-flight said: ${explainProbe(probe)} ` +
        `URL: ${authUrl} (Underlying: ${e?.message || e})`,
    );
  }
  const code = new URL(redirected).searchParams.get('code');
  if (!code) throw new Error('No authorization code returned.');
  const res = await fetch(`${origin}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: DEALERCORE_CONFIG.CLIENT_ID,
      redirect_uri: redirectUri(),
      code,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}).`);
  const data = await res.json();
  const token = data.access_token;
  if (!token) throw new Error('No access token in response.');
  await browser.storage.local.set({
    dealercore_base_url: origin,
    dealercore_signed_out: false,
    [tokenKeyFor(origin)]: token,
    dealercore_session: { ...(data.user ? { user: data.user } : {}), savedAt: Date.now() },
  });
  return token;
}

async function authed(base, token, path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    // Token invalid — drop it so UI falls back to Login.
    await browser.storage.local.remove([tokenKeyFor(base)]);
    throw new Error('Unauthenticated (401). Please log in again.');
  }
  if (!res.ok) throw new Error(`DealerCore request failed (${res.status}).`);
  return res.json();
}

export async function fetchMe(base, token) {
  return authed(base, token, '/api/v1/auth/me');
}

export async function fetchVehicles({ status, branch_id, page = 1, per_page = 25 } = {}) {
  const { base, token } = await getAccessToken();
  if (!token) throw new Error('Not connected. Log in with DealerCore first.');
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (branch_id) params.set('branch_id', String(branch_id));
  params.set('page', String(page));
  params.set('per_page', String(per_page));
  return authed(base, token, `/api/v1/facebook-marketplace/vehicles?${params.toString()}`);
}

// status: 'created' | 'updated' | 'failed'
export async function writeBackSync({ vehicle_id, status, account_id, post_id, post_url, message }) {
  const { base, token } = await getAccessToken();
  if (!token) throw new Error('Not connected. Skipping write-back.');
  return authed(base, token, '/api/v1/facebook-marketplace/vehicles', {
    method: 'POST',
    body: JSON.stringify({ vehicle_id, status, account_id, post_id, post_url, message }),
  });
}

export async function clearDealerCoreSession() {
  // Remove tokens for EVERY known environment, not just the active one, so a
  // stale token can't silently reconnect after switching domains.
  const all = await browser.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith('token_'));
  keys.push('dealercore_session', 'auth');
  await browser.storage.local.remove(keys);
  // Suppress the silent handshake until the user explicitly connects again,
  // otherwise any DealerCore tab would instantly restore the session.
  await browser.storage.local.set({ dealercore_signed_out: true });
  return keys.length;
}

/**
 * Validate the stored session regardless of how it was obtained
 * (OAuth code exchange or silent handshake). Works off the per-domain token,
 * never off the UI's `auth` object, which has no token in handshake mode.
 */
export async function verifySession() {
  const base = await getDealerCoreBaseUrl();
  const { token } = await getAccessToken(base);
  if (!token) {
    return { base, connected: false, reason: 'No token stored for this environment.' };
  }
  try {
    const me = await fetchMe(base, token);
    return { base, connected: true, me };
  } catch (e) {
    return { base, connected: false, reason: e?.message || String(e) };
  }
}
