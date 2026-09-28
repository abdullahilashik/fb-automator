// DealerCore integration config (auth-guide.md §3).
// CLIENT_ID is the First-Party OAuth client created in Nova Admin.
// Paste the real value here — everything else adapts dynamically.
export const DEALERCORE_CONFIG = {
  CLIENT_ID: '9a5c8e32-2d14-41b9-8390-1c5c0a377755',
  // Origin only — never append paths like /nova. All API/OAuth paths are
  // appended by dealercore-api.js. Nova (/nova/login) is the admin panel and
  // is NOT part of the runtime OAuth flow.
  DEFAULT_DOMAIN: 'https://dev.dealercore.com.au',
  PROD_DOMAIN: 'https://dealercore.com.au',
  // chrome.identity redirect — extension id is filled in at runtime.
  REDIRECT_PATH: '/',
  // Silent handshake: the guide (§3 Flow A) states client_id is "strictly
  // required to ensure the requesting client is a valid First-Party
  // application", so we send it. Worth knowing: the server checks the session
  // cookie *before* the client, so a 401 here never means "bad client_id" —
  // it means no active DealerCore session.
  HANDSHAKE_SEND_CLIENT_ID: true,
  // OAuth scopes requested at /oauth/authorize. Left empty because the
  // guide specifies no scopes; a blank value omits the `scope` param
  // entirely rather than sending `scope=`, which some Passport setups
  // reject before they ever get to validating the client.
  SCOPE: '',
};

export const DEALERCORE_HOSTS = {
  prod: 'dealercore.com.au',
  testSuffix: '.test',
};

export function isDealerCoreHostname(hostname) {
  if (!hostname) return false;
  if (hostname === 'localhost') return true;
  if (hostname.endsWith('.test')) return true;
  if (hostname === DEALERCORE_HOSTS.prod) return true;
  if (hostname.endsWith(`.${DEALERCORE_HOSTS.prod}`)) return true;
  return false;
}

export function tokenKeyFor(baseUrl) {
  return `token_${baseUrl}`;
}

/**
 * Storage key for the OAuth refresh token (guide §3). Kept per-origin like the
 * access token so switching environments can't renew against the wrong client.
 */
export function refreshKeyFor(baseUrl) {
  return `refresh_${baseUrl}`;
}
