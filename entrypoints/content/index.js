import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { findLabelByText } from '@/utils/find-label-by';
import { handleAutosuggestDropdown, handleCheckbox, handleDropdown, handlePhotos } from '@/utils/handle-form-field';
import { typeLikeHuman } from '@/utils/input-simulation';
import { sleep } from '@/utils/sleep';

const TARGET_URL = 'https://www.facebook.com/marketplace/create/vehicle';

async function processItem(item) {
    // 1. Vehicle Type
    await handleDropdown('Vehicle type', item.vehicleType);

    // 2. Photos
    await handlePhotos(item.imageUrls);

    // 3. Location
    await handleAutosuggestDropdown(item.location);

    // 4. Basic Info (Inputs)
    const inputs = [
        { label: 'Make', value: item.make },
        { label: 'Model', value: item.model },
        { label: 'Mileage', value: item.mileage },
        { label: 'Price', value: item.price }
    ];

    for (const field of inputs) {
        const container = findLabelByText(field.label);
        const input = container?.querySelector('input');
        if (input) {
            await typeLikeHuman(input, field.value);
            await sleep(500);
        } else {
            console.log(`Input not found: ${field.label}`);
        }
    }

    // 5. Dropdowns
    await handleDropdown('Year', item.year);
    await handleDropdown('Fuel type', item.fuelType);
    await handleDropdown('Transmission', item.transmission);
    await handleDropdown('Body style', item.bodyStyle);
    await handleDropdown('Vehicle condition', item.condition);
    await handleDropdown('Exterior colour', item.exteriorColour);
    await handleDropdown('Interior colour', item.interiorColour);

    // 6. Clean Title Checkbox
    await handleCheckbox('clean title');

    // 7. Description (Textarea)
    const descContainer = findLabelByText('Description');
    const textarea = descContainer?.querySelector('textarea');
    if (textarea) {
        await typeLikeHuman(textarea, item.description);
    }

    return true;
}

async function clickButton(label) {
    console.log(`Waiting for ${label} button...`);
    for (let i = 0; i < 50; i++) { // Max 25 seconds
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
    const csvContent = "data:text/csv;charset=utf-8," + "ID,Status\n" + results.map(r => `${r.id},${r.status}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "automation_results.csv");
    document.body.appendChild(link);
    link.click();
}

async function runAutomation(itemsToProcess, startIndex, results) {
    let currentIndex = startIndex || 0;
    let currentResults = results || [];

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
            // Check if form is actually loaded before processing
            await sleep(2000);
            await processItem(item);

            // Sequential button clicks
            if (await clickButton('Next')) {
                await sleep(2000);
                if (await clickButton('Publish')) {
                    console.log(`Item ${item.id} published successfully.`);
                    currentResults.push({ id: item.id, status: "Success" });
                    // Wait for redirect to finish before moving to next item
                    await sleep(8000);
                } else {
                    throw new Error("Publish button not found/enabled");
                }
            } else {
                throw new Error("Next button not found/enabled");
            }
        } catch (error) {
            console.error(`Error processing item ${item.id}:`, error);
            currentResults.push({ id: item.id, status: "Failed" });
        }

        // Save progress for the *next* iteration
        await browser.storage.local.set({ currentIndex: i + 1, results: currentResults });
        await sleep(2000);
    }

    // Automation complete
    await generateCSV(currentResults);
    await browser.storage.local.remove(['items', 'currentIndex', 'results']);
    console.log("Automation Complete");
}

async function init() {
    const data = await browser.storage.local.get(['items', 'currentIndex', 'results']);
    if (data.items && window.location.href.includes(TARGET_URL)) {
        console.log("Resuming automation...");
        await runAutomation(data.items, data.currentIndex, data.results);
    }
}

export default defineContentScript({
    matches: ['https://www.facebook.com/marketplace/create/*'],
    async main() {
        // --- MESSAGE HANDLER ---
        browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
            if (request.action === "START_AUTOMATION") {
                const data = await browser.storage.local.get(['items', 'currentIndex', 'results']);
                if (data.items) {
                    await runAutomation(data.items, data.currentIndex || 0, data.results || []);
                    sendResponse({ status: "Complete" });
                }
            }
            return true;
        });

        init();
    },
});