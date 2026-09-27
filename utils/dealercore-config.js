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
  // Silent handshake: sending client_id makes DealerCore verify the client is
  // active AND marked First Party. That check fails until the client is
  // flagged, so we omit client_id by default and rely on the session cookie
  // (auth-guide §3 Flow B lists client_id as optional). Set true once the
  // client is marked First Party if you want the extra validation.
  HANDSHAKE_SEND_CLIENT_ID: false,
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
