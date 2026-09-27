import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { appendVehicles } from '@/utils/default-items';
import { clearDealerCoreSession } from '@/utils/dealercore-api';
import { fromDealerCoreVehicle } from '@/utils/default-items';


// Dexie Operations
import {db} from '@/utils/db';


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


      //  single vehicles all at once
      if(request.type == 'SYNC_VEHICLES') {
        db.vehicles
          .bulkPut(request.payload)
          .then(
            (lastResultKey) => {
              sendResponse({
                success: true,
                count: request.payload.length,
                lastKey: lastResultKey
              })
            }
          )
          .catch((error) => {
            console.error(`Failed to sync vehicles to indexed db: ${error}`)
            sendResponse({success: false, error: String(error)});
          })
      }

      // save or update a single vehicle
      if(request.type === 'SAVE_SINGLE_VEHICLE') {
        db.vehicles
          .put(request.payload)
          .then((id) => {
            sendResponse({ success: true, id});
          })
          .catch((error) => {
            console.log(`Failed to SAVE_SINGLE_VEHICLE for: ${error}`);
            sendResponse({success: false, error: String(error)});
          })
      }

      // clear all vehicles from indexed db
      if(request.type === 'CLEAR_VEHICLES') {
        db.vehicles
          .clear()
          .then(() => sendResponse({success: true}))
          .catch((error) => sendResponse({success: false}));
      }      


      sendResponse({ status: 'ignored' });
    })();
    // keep the message line open for async sendResponse
    return true;
  });
});
