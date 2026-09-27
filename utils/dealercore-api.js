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
  if (!DEALERCORE_CONFIG.CLIENT_ID || DEALERCORE_CONFIG.CLIENT_ID === 'YOUR_FIRST_PARTY_CLIENT_ID') {
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
  const params = new URLSearchParams({
    client_id: DEALERCORE_CONFIG.CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: '',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `${origin}/oauth/authorize?${params.toString()}`;
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

export async function launchOAuthLogin(base) {
  assertClientConfigured();
  const origin = normalizeBaseUrl(base);
  const { verifier, challenge } = await createPkce();
  const authUrl = buildAuthorizeUrl(origin, challenge);
  let redirected;
  try {
    redirected = await browser.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });
  } catch (e) {
    throw new Error(
      `Authorization page could not be loaded (${origin}/oauth/authorize). ` +
        `Check the domain is reachable, the OAuth client exists with redirect URI ${redirectUri()}, and CLIENT_ID matches. (Underlying: ${e?.message || e})`,
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
  const stored = await browser.storage.local.get(['dealercore_base_url']);
  const base = stored.dealercore_base_url;
  const keys = ['dealercore_session'];
  if (base) keys.push(tokenKeyFor(base));
  await browser.storage.local.remove(keys);
}
