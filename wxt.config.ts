import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ manifestVersion }) => ({
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
      // DealerCore stores vehicle photos on AWS S3/CloudFront. The background
      // downloads them (to bypass the bucket's CORS policy), and Firefox MV2
      // content scripts fetch them directly using the extension's host
      // privileges — neither can read the response unless the origin is granted
      // up front. Without this, Firefox uploads a placeholder and Facebook
      // shows "Image Unavailable".
      'https://*.amazonaws.com/*',
      'https://*.cloudfront.net/*',
    ],
    // Any other image CDN is requested on demand (see the FETCH_IMAGE handler
    // and the sidepanel's pre-run request). MV3 splits host patterns into
    // `optional_host_permissions`; MV2 (Firefox) uses `optional_permissions`.
    ...(manifestVersion === 2
      ? { optional_permissions: ['https://*/*', 'http://*/*'] }
      : { optional_host_permissions: ['https://*/*', 'http://*/*'] }),
  }),
});
