import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'FB Marketplace Automator',
    description: 'Automate Facebook Marketplace vehicle listings',
    action: {
      default_title: 'DealerCore',
    },
    permissions: ['storage', 'activeTab'],
    host_permissions: ['https://www.facebook.com/*'],
  },
});