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
    ],
  },
});