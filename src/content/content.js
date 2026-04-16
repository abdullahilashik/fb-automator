import { findLabelByText } from "../utils/find-label-by";
import { handleAutosuggestDropdown, handleCheckbox, handleDropdown, handleLocation, handlePhotos } from "../utils/handle-form-field";
import {typeLikeHuman} from '../utils/input-simulation';
import {sleep} from '../utils/sleep';

// --- MAIN EXECUTION ---

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "START_AUTOMATION") {
        const item = request.payload;

        // 1. Vehicle Type
        await handleDropdown('Vehicle type', item.vehicleType);

        // 2. Photos
        await handlePhotos(item.imageUrls);

        // 3. Location
        await handleAutosuggestDropdown(item.location);
        // await handleLocation(item.location);     
        

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

        console.log("Automation Complete");
        sendResponse({ status: "Complete" });

        // 8. Click Next button when enabled, then Publish button
        const clickButtonByLabel = (label) => {
            const buttons = Array.from(document.querySelectorAll('[role="button"]'));
            const button = buttons.find(btn => btn.innerText.includes(label) || btn.getAttribute('aria-label') === label);
            
            if (button) {
                const isDisabled = button.getAttribute('aria-disabled') === 'true';
                if (!isDisabled) {
                    console.log(`${label} button found and enabled, clicking forcefully...`);
                    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                    return true;
                }
            }
            return false;
        };

        // Click Next, then wait for Publish to appear and click it
        if (!clickButtonByLabel('Next')) {
            console.log('Next button not enabled, observing...');
            const observer = new MutationObserver((mutations, obs) => {
                if (clickButtonByLabel('Next')) {
                    obs.disconnect();
                    // Wait for the UI to transition, then look for Publish
                    setTimeout(() => {
                        if (!clickButtonByLabel('Publish')) {
                            const publishObserver = new MutationObserver((m, o) => {
                                if (clickButtonByLabel('Publish')) {
                                    o.disconnect();
                                }
                            });
                            publishObserver.observe(document.body, { childList: true, subtree: true });
                        }
                    }, 1000);
                }
            });
            observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['aria-disabled'] });
            setTimeout(() => observer.disconnect(), 30000);
        } else {
            // Already clicked next, wait for publish
            setTimeout(() => {
                if (!clickButtonByLabel('Publish')) {
                    const publishObserver = new MutationObserver((m, o) => {
                        if (clickButtonByLabel('Publish')) {
                            o.disconnect();
                        }
                    });
                    publishObserver.observe(document.body, { childList: true, subtree: true });
                }
            }, 1000);
        }
    }
    return true;
});