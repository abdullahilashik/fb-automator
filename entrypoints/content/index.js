import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { findLabelByText } from '@/utils/find-label-by';
import { handleAutosuggestDropdown, handleCheckbox, handleDropdown, handlePhotos } from '@/utils/handle-form-field';
import { typeLikeHuman } from '@/utils/input-simulation';
import { fromDealerCoreVehicle } from '@/utils/default-items';
import { sleep } from '@/utils/sleep';
import { writeBackSync } from '@/utils/dealercore-api';

const TARGET_URL = 'https://www.facebook.com/marketplace/create/vehicle';

// --- CANCELLATION ---
// The sidepanel sets `automation_state.cancelRequested`; we mirror it into a
// module-level flag via storage.onChanged so the hot loops (typing, button
// polling) can bail synchronously instead of awaiting a storage read.
let cancelRequested = false;

class CancelledError extends Error {
    constructor() {
        super('Cancelled by user');
        this.name = 'CancelledError';
    }
}

const shouldAbort = () => cancelRequested;

function throwIfCancelled() {
    if (cancelRequested) throw new CancelledError();
}

async function initCancelWatcher() {
    const data = await browser.storage.local.get(['automation_state']);
    cancelRequested = !!data.automation_state?.cancelRequested;
    browser.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.automation_state) return;
        cancelRequested = !!changes.automation_state.newValue?.cancelRequested;
    });
}

async function setPhase(phase, extra = {}) {
    await browser.storage.local.set({
        automation_state: { phase, cancelRequested: phase === 'cancelled' || cancelRequested, ...extra },
    });
}

// Clear the queue so `init()` cannot resume after a cancel. `results` is kept
// so the panel can still show which vehicle was interrupted.
async function abortRun(results, pendingId) {
    if (pendingId != null && !results.some((r) => r.id === pendingId)) {
        results.push({ id: pendingId, status: 'Cancelled' });
    }
    console.log('Automation cancelled by user.');
    await browser.storage.local.remove(['runQueueIds', 'currentIndex']);
    await browser.storage.local.set({ results });
    await setPhase('cancelled', { finishedAt: Date.now() });
}

// The vehicle list lives in the extension's IndexedDB (Dexie). This content
// script runs against the facebook.com page origin, so it cannot touch that DB
// directly — it reads through the background worker and keeps only the
// per-run `runQueueIds` selection in storage.
async function loadQueue() {
    const { runQueueIds } = await browser.storage.local.get(['runQueueIds']);
    if (!Array.isArray(runQueueIds) || runQueueIds.length === 0) return [];
    const res = await browser.runtime.sendMessage({ type: 'GET_VEHICLES' });
    const vehicles = Array.isArray(res?.vehicles) ? res.vehicles : [];
    const wanted = new Set(runQueueIds);
    const queue = [];
    for (const v of vehicles) {
        const item = fromDealerCoreVehicle(v);
        if (item && wanted.has(v.id)) queue.push({ ...item, id: v.id });
    }
    return queue;
}

async function processItem(item) {
    throwIfCancelled();
    // 1. Vehicle Type
    await handleDropdown('Vehicle type', item.vehicleType, shouldAbort);
    throwIfCancelled();

    // 2. Photos
    await handlePhotos(item.imageUrls, shouldAbort);
    throwIfCancelled();

    // 3. Location
    await handleAutosuggestDropdown(item.location, shouldAbort);
    throwIfCancelled();

    // 4. Basic Info (Inputs)
    const inputs = [
        { label: 'Make', value: item.make },
        { label: 'Model', value: item.model },
        { label: 'Mileage', value: item.mileage },
        { label: 'Price', value: item.price }
    ];

    for (const field of inputs) {
        throwIfCancelled();
        const container = findLabelByText(field.label);
        const input = container?.querySelector('input');
        if (input) {
            await typeLikeHuman(input, field.value, shouldAbort);
            await sleep(500);
        } else {
            console.log(`Input not found: ${field.label}`);
        }
    }

    // 5. Dropdowns
    await handleDropdown('Year', item.year, shouldAbort);
    await handleDropdown('Fuel type', item.fuelType, shouldAbort);
    await handleDropdown('Transmission', item.transmission, shouldAbort);
    await handleDropdown('Body style', item.bodyStyle, shouldAbort);
    await handleDropdown('Vehicle condition', item.condition, shouldAbort);
    await handleDropdown('Exterior colour', item.exteriorColour, shouldAbort);
    await handleDropdown('Interior colour', item.interiorColour, shouldAbort);
    throwIfCancelled();

    // 6. Clean Title Checkbox
    await handleCheckbox('clean title');

    // 7. Description (Textarea)
    const descContainer = findLabelByText('Description');
    const textarea = descContainer?.querySelector('textarea');
    if (textarea) {
        await typeLikeHuman(textarea, item.description, shouldAbort);
    }
    throwIfCancelled();

    return true;
}

async function clickButton(label) {
    console.log(`Waiting for ${label} button...`);
    for (let i = 0; i < 50; i++) { // Max 25 seconds
        throwIfCancelled();
        const buttons = Array.from(document.querySelectorAll('[role="button"]'));
        const button = buttons.find(btn => btn.innerText.includes(label) || btn.getAttribute('aria-label') === label);

        if (button) {
            const isDisabled = button.getAttribute('aria-disabled') === 'true';
            if (!isDisabled) {
                console.log(`${label} button found and enabled, clicking...`);
                button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                return true;
            }
        }
        await sleep(500);
    }
    console.log(`${label} button not found or not enabled.`);
    return false;
}

async function generateCSV(results) {
    const header = "ID,Status,ListingID,PostURL";
    const rows = (Array.isArray(results) ? results : []).map(
        (r) => `${r.id},${r.status},${r.listing_id ?? ''},${r.post_url ?? ''}`,
    );
    const csvContent = "data:text/csv;charset=utf-8," + [header, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "automation_results.csv");
    document.body.appendChild(link);
    link.click();
}

function extractPostInfo() {
    const href = window.location.href || '';
    const itemMatch = href.match(/marketplace\/item\/(\d+)/);
    const post_id = itemMatch ? itemMatch[1] : '';
    return { post_id, post_url: post_id ? `https://www.facebook.com/marketplace/item/${post_id}/` : href };
}

const LISTING_ID_RE = /[?&]listing_id=(\d+)/;

// After Publish, Facebook doesn't always land on the listing URL, so the
// listing id is read out of the "More options" menu instead:
//   1. Click the trigger  div[aria-label^="More options for"]
//   2. Read the menu links div[aria-label="More options for listing"] a[role="menuitem"]
//   3. Parse listing_id from a menu href like .../edit/?listing_id=...&__tn__=...
// The menu is closed afterwards so the next iteration can navigate away cleanly.
async function extractListingIdAfterPublish() {
    // Step 1: find and open the "More options" menu.
    let trigger = null;
    for (let i = 0; i < 60 && !trigger; i++) { // up to 30s
        throwIfCancelled();
        trigger = document.querySelector('div[aria-label^="More options for"]');
        if (!trigger) await sleep(500);
    }
    if (!trigger) {
        console.log('More options trigger not found.');
        return null;
    }
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    await sleep(800);

    // Step 2: read the menu item links.
    let menuLinks = [];
    for (let i = 0; i < 20 && menuLinks.length === 0; i++) { // up to 10s
        throwIfCancelled();
        menuLinks = Array.from(
            document.querySelectorAll('div[aria-label="More options for listing"] a[role="menuitem"]'),
        );
        if (menuLinks.length) break;
        // Tolerant fallback: any menu item link that carries a listing_id.
        menuLinks = Array.from(document.querySelectorAll('a[role="menuitem"]')).filter(
            (a) => LISTING_ID_RE.test(a.getAttribute('href') || ''),
        );
        if (!menuLinks.length) await sleep(500);
    }

    // Step 3: close the menu (Escape), matching Facebook's own dismissal.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
    await sleep(300);

    // Step 4: extract the first listing id seen.
    for (const a of menuLinks) {
        const match = (a.getAttribute('href') || '').match(LISTING_ID_RE);
        if (match) {
            const post_id = match[1];
            console.log(`Extracted listing_id ${post_id} from "${a.getAttribute('href')}".`);
            return {
                post_id,
                post_url: `https://www.facebook.com/marketplace/item/${post_id}/`,
            };
        }
    }
    console.log('No listing_id found in the More options menu.');
    return null;
}

// Best-effort write-back — never throws into the automation loop.
async function reportSync(item, status, message) {
    if (item?.dealerCoreId == null) return;
    try {
        await writeBackSync({
            vehicle_id: item.dealerCoreId,
            status,
            account_id: '',
            post_id: item._lastPostId || '',
            post_url: item._lastPostUrl || '',
            message: message || null,
        });
    } catch (err) {
        console.warn(`[dealercore] write-back (${status}) failed for vehicle ${item.dealerCoreId}:`, err?.message || err);
    }
}

// FB renders "Save draft" as a div with aria-label="Save Draft" and
// role="button". Draft mode clicks it instead of Publish.
const SAVE_DRAFT_SELECTOR = 'div[aria-label="Save Draft"]';

async function clickSaveDraft() {
    console.log('Waiting for Save Draft button...');
    for (let i = 0; i < 60; i++) { // Max 30 seconds
        throwIfCancelled();
        const button = document.querySelector(SAVE_DRAFT_SELECTOR);
        if (button) {
            const isDisabled = button.getAttribute('aria-disabled') === 'true';
            if (!isDisabled) {
                console.log(`Save Draft button found, clicking (attempt ${i + 1})...`);
                button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                return true;
            }
        }
        await sleep(500);
    }
    console.log('Save Draft button not found or not enabled.');
    return false;
}

async function runAutomation(itemsToProcess, startIndex, results, runMode) {
    let currentIndex = startIndex || 0;
    let currentResults = results || [];
    // `runMode` is passed in explicitly ('draft' | 'publish'), never derived
    // from storage here, so no shared-state race can flip the mode mid-run.
    if (runMode !== 'draft') runMode = 'publish';
    console.log(`[draft] run mode = ${runMode}`);
    await setPhase('running', { mode: runMode });

    for (let i = currentIndex; i < itemsToProcess.length; i++) {
        // 1. Ensure we are on the creation page before starting each item
        if (!window.location.href.includes(TARGET_URL)) {
            console.log("Navigating to creation page...");
            window.location.href = TARGET_URL;
            // Important: We must not continue until the page reloads
            return;
        }

        const item = itemsToProcess[i];
        console.log(`Processing item ${item.id} (${i + 1}/${itemsToProcess.length})`);

        try {
            throwIfCancelled();
            // Check if form is actually loaded before processing
            await sleep(2000);
            await processItem(item);

            // Sequential button clicks
            let saved = false;
            if (runMode === 'draft') {
                // Drafts never publish: click "Save Draft" directly from the
                // form screen — no Next step. If a future FB layout puts the
                // button behind Next, fall back to that path.
                saved = await clickSaveDraft();
                if (!saved && (await clickButton('Next'))) {
                    throwIfCancelled();
                    await sleep(2000);
                    saved = await clickSaveDraft();
                }
            } else if (await clickButton('Next')) {
                throwIfCancelled();
                await sleep(2000);
                saved = await clickButton('Publish');
            }
            if (!saved) {
                throw new Error(
                    runMode === 'draft'
                        ? "Save draft button not found/enabled"
                        : "Next/Publish button not found/enabled",
                );
            }
            {
                console.log(`Item ${item.id} ${runMode === 'draft' ? 'draft saved' : 'published'}.`);
                // Wait for redirect to finish before moving to next item
                await sleep(8000);
                // Published items: grab the listing id from the "More options"
                // menu, falling back to a URL parse. Drafts never get a live
                // listing, so they keep whichever (empty) url follows.
                const info =
                    runMode === 'publish'
                        ? (await extractListingIdAfterPublish()) || extractPostInfo()
                        : extractPostInfo();
                const post_id = info?.post_id || '';
                const post_url = info?.post_url || '';
                item._lastPostId = post_id;
                item._lastPostUrl = post_url;
                currentResults.push({
                    id: item.id,
                    status: runMode === 'draft' ? "Draft" : "Success",
                    listing_id: post_id,
                    post_url,
                });
                await reportSync(item, item.dealerCoreStatus === 'update' ? 'updated' : 'created');
            }
        } catch (error) {
            // A cancel is not a failure: stop immediately, keep the queue clean.
            if (error?.name === 'CancelledError' || cancelRequested) {
                await abortRun(currentResults, item.id);
                return;
            }
            console.error(`Error processing item ${item.id}:`, error);
            currentResults.push({ id: item.id, status: "Failed" });
            await reportSync(item, 'failed', error?.message || String(error));
        }

        // Save progress for the *next* iteration
        await browser.storage.local.set({ currentIndex: i + 1, results: currentResults });
        if (cancelRequested) {
            await abortRun(currentResults, null);
            return;
        }
        await sleep(2000);
    }

    // Automation complete
    await generateCSV(currentResults);
    // Keep `results` so the panel can render which vehicles succeeded; only
    // the run queue and progress are dropped. The Dexie master list survives.
    await browser.storage.local.remove(['runQueueIds', 'currentIndex']);
    await setPhase('complete', { finishedAt: Date.now() });
    console.log("Automation Complete");
}

async function init() {
    const data = await browser.storage.local.get([
        'runQueueIds',
        'currentIndex',
        'results',
        'automation_state',
    ]);
    // Never auto-resume a queue the user cancelled.
    if (data.automation_state?.cancelRequested) {
        console.log("Cancel requested — not resuming.");
        return;
    }
    if (data.runQueueIds && window.location.href.includes(TARGET_URL)) {
        console.log("Resuming automation...");
        const queue = await loadQueue();
        if (queue.length) {
            // Resume honours whichever mode the run was started in.
            const mode = data.automation_state?.mode === 'draft' ? 'draft' : 'publish';
            await runAutomation(queue, data.currentIndex, data.results, mode);
        }
    }
}

export default defineContentScript({
    matches: ['https://www.facebook.com/marketplace/create/*'],
    async main() {
        await initCancelWatcher();

        // --- MESSAGE HANDLER ---
        browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
            if (request.action === "START_AUTOMATION") {
                // Fresh run: clear any previous cancel request.
                cancelRequested = false;
                const data = await browser.storage.local.get([
                    'runQueueIds',
                    'currentIndex',
                    'results',
                    'automation_state',
                ]);
                const queue = await loadQueue();
                if (queue.length) {
                    // The sidepanel passes the mode in the message itself; only
                    // fall back to storage when it was omitted.
                    const mode =
                        request.mode === 'draft'
                            ? 'draft'
                            : data.automation_state?.mode === 'draft'
                              ? 'draft'
                              : 'publish';
                    await runAutomation(
                        queue,
                        data.currentIndex || 0,
                        data.results || [],
                        mode,
                    );
                    sendResponse({ status: "Complete" });
                }
            }
            return true;
        });

        init();
    },
});