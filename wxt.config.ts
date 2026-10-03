import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'FB Marketplace Automator',
    description: 'Automate Facebook Marketplace vehicle listings',
    action: {
      default_title: 'DealerCore',
    },
    permissions: ['storage', 'activeTab', 'cookies', 'scripting', 'identity'],
    host_permissions: [
      'https://www.facebook.com/*',
      'https://dealercore.com.au/*',
      'https://*.dealercore.com.au/*',
      'http://*.test/*',
      'http://localhost/*',
      // `localhost` resolves to ::1 on many Windows setups while a dev server
      // (e.g. `php artisan serve`) binds IPv4-only, so 127.0.0.1 must be allowed
      // too or the OAuth pre-flight/flow fails with "Failed to fetch".
      'http://127.0.0.1/*',
    ],
    // Requested on demand so the background can download S3/CDN images that
    // omit CORS headers (see the FETCH_IMAGE handler). The user is prompted
    // once per image origin.
    optional_host_permissions: ['https://*/*', 'http://*/*'],
  },
});