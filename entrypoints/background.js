import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';

export default defineBackground(() => {
  if (browser.sidePanel) {
    browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => { });
  }

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'NAVIGATE_TO_CREATE') {
      browser.tabs.update(sender.tab.id, {
        url: 'https://www.facebook.com/marketplace/create/vehicle',
      });
    }
    // keep the message line open
    return true;
  });
});