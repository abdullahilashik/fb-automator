import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { appendVehicles } from '@/utils/default-items';
import { clearDealerCoreSession } from '@/utils/dealercore-api';
import { fromDealerCoreVehicle } from '@/utils/default-items';

export default defineBackground(() => {
  if (browser.sidePanel) {
    browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => { });
  }

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      if (request.action === 'NAVIGATE_TO_CREATE') {
        await browser.tabs.update(sender.tab.id, {
          url: 'https://www.facebook.com/marketplace/create/vehicle',
        });
        sendResponse({ status: 'navigating' });
        return;
      }
      if (request.action === 'TRIGGER_MARKETPLACE_SYNC' && request.vehicle) {
        // Belt-and-suspenders: bridge content script already appended to
        // storage, but a direct message (or a missed write) lands here too.
        const mapped = fromDealerCoreVehicle(request.vehicle);
        if (mapped) {
          const stored = await browser.storage.local.get(['items']);
          const base = Array.isArray(stored.items) ? stored.items : [];
          const exists = mapped.dealerCoreId != null &&
            base.some((it) => it.dealerCoreId === mapped.dealerCoreId);
          if (!exists) {
            await browser.storage.local.set({ items: appendVehicles(base, [mapped]) });
          }
        }
        sendResponse({ status: 'queued' });
        return;
      }
      if (request.action === 'DEALERCORE_LOGOUT') {
        await clearDealerCoreSession();
        sendResponse({ status: 'logged-out' });
        return;
      }
      sendResponse({ status: 'ignored' });
    })();
    // keep the message line open for async sendResponse
    return true;
  });
});
