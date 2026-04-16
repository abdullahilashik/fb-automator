import { findLabelByText } from "./find-label-by";
import { typeLikeHuman } from "./input-simulation";
import { sleep } from "./sleep";

// Handle Facebook's custom Dropdowns
export const handleDropdown = async (labelName, optionText) => {
    if (!optionText) return;
    const label = findLabelByText(labelName);
    if (!label) return console.log(`Skipping ${labelName}: Field not found.`);

    label.click();
    await sleep(800); // Wait for menu

    const options = Array.from(document.querySelectorAll('[role="option"]'));
    const target = options.find(opt =>
        opt.textContent.toLowerCase().includes(optionText.toLowerCase())
    );

    if (target) {
        target.click();
        await sleep(500);
    }
};

// handle location dropdown
export const handleAutosuggestDropdown = async (locationText) => {
    if (!locationText) return;
    const label = findLabelByText('Location');
    const input = label?.querySelector('input');
    if (!input) return;

    // Type the full location character by character
    input.focus();
    input.value = "";
    for (let i = 0; i < locationText.length; i++) {
        input.value = locationText.substring(0, i + 1);
        input.dispatchEvent(new InputEvent('input', { bubbles: true, data: locationText[i] }));
        await sleep(Math.random() * 50 + 30);
    }
    input.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Wait for the listbox to appear
    await sleep(1500);

    // Function to find suggestions
    const findSuggestions = () => {
        // Try various selectors
        const selectors = [
            '[role="listbox"] > [role="option"]',
            '[role="listbox"] [role="option"]',
            '[aria-expanded="true"] [role="option"]',
            'div[role="listbox"] div[role="option"]'
        ];
        for (const sel of selectors) {
            const opts = document.querySelectorAll(sel);
            if (opts.length > 0) return Array.from(opts);
        }
        return [];
    };

    let options = findSuggestions();
    console.log('Location - suggestions found:', options.length);

    // If no suggestions, try shorter text
    let currentText = locationText;
    while (options.length === 0 && currentText.length > 2) {
        currentText = currentText.slice(0, -1);
        input.value = currentText;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(1000);
        options = findSuggestions();
    }

    // If we found suggestions, select via keyboard
    if (options.length > 0) {
        const firstOpt = options[0];
        console.log('Selecting option via keyboard:', firstOpt.textContent?.trim().substring(0, 30));
        
        input.focus();
        // Send ArrowDown to highlight
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true, cancelable: true }));
        await sleep(300);
        
        // Try Tab to accept the selection (common in FB/React forms)
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, bubbles: true, cancelable: true }));
        
        // Also send Enter just in case
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
        
        // Sometimes need to trigger an input event to let React know
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        await sleep(500);
    } else {
        // Try Tab to move away (might accept selection)
        input.blur();
        await sleep(300);
    }
};

// Handle Location (Typing + Clicking first suggestion)
export const handleLocation = async (locationText) => {
    if (!locationText) return;
    const label = findLabelByText('Location');
    const input = label?.querySelector('input');
    if (!input) return;

    await typeLikeHuman(input, locationText);
    await sleep(1500); // Wait for FB to fetch suggestions

    // Look for the first suggestion in the popup menu
    const firstSuggestion = document.querySelector('[role="listbox"] [role="option"], .x1n2onr6 [role="option"]');
    if (firstSuggestion) {
        firstSuggestion.click();
        await sleep(500);
    }
};

// Handle Checkbox (Clean Title)
export const handleCheckbox = async (labelText) => {
    const spans = Array.from(document.querySelectorAll('span'));
    const target = spans.find(s => s.textContent.trim().toLowerCase().includes(labelText.toLowerCase()));
    const label = target?.closest('label');
    const input = label?.querySelector('input[type="checkbox"]');
    if (input && !input.checked) {
        input.click();
        await sleep(300);
    }
};

// Handle Photo Uploads (via DataTransfer)
export const handlePhotos = async (urls) => {
    if (!urls || urls.length === 0) return;
    const fileInput = document.querySelector('input[type="file"][accept*="image"]');
    if (!fileInput) return;

    const dataTransfer = new DataTransfer();
    for (const url of urls) {
        try {
            const resp = await fetch(url);
            const blob = await resp.blob();
            const file = new File([blob], "image.jpg", { type: "image/jpeg" });
            dataTransfer.items.add(file);
        } catch (e) {
            console.error("Image fetch failed", e);
        }
    }
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
};