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