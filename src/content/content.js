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

        // 8. Handle Next and Publish buttons
        const clickButton = async (label) => {
            console.log(`Waiting for ${label} button...`);
            
            // Wait for button to exist and be enabled
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
        };

        await clickButton('Next');
        await sleep(1000);
        await clickButton('Publish');

        console.log("Automation Complete");
        sendResponse({ status: "Complete" });
    }
    return true;
});