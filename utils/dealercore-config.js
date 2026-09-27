import 'dotenv/config';

// DealerCore integration config (auth-guide.md §3).
// CLIENT_ID is the First-Party OAuth client created in Nova Admin.
// Paste the real value here — everything else adapts dynamically.
export const DEALERCORE_CONFIG = {
  CLIENT_ID: process.env.CLIENT_ID || 'YOUR_FIRST_PARTY_CLIENT_ID',
  // Origin only — never append paths like /nova. All API/OAuth paths are
  // appended by dealercore-api.js. Nova (/nova/login) is the admin panel and
  // is NOT part of the runtime OAuth flow.
  DEFAULT_DOMAIN: process.env.DEFAULT_DOMAIN || 'https://dev.dealercore.com.au',
  PROD_DOMAIN: process.env.PROD_DOMAIN || 'https://dealercore.com.au',
  // chrome.identity redirect — extension id is filled in at runtime.
  REDIRECT_PATH: process.env.REDIRECT_PATH || '/',
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
