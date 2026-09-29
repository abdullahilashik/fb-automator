import { findLabelByText } from "./find-label-by";
import { typeLikeHuman } from "./input-simulation";
import { sleep } from "./sleep";
import { browser } from "wxt/browser";

// Collect only the options that are actually visible and enabled right now.
// FB keeps closed/hidden menus in the DOM (`aria-hidden`, `[hidden]`, disabled
// rows), so a naive `[role="option"]` query can surface a stale duplicate that
// `.click()` silently ignores while the real option is skipped.
const collectVisibleOptions = () => {
    return Array.from(document.querySelectorAll('[role="option"]')).filter((opt) => {
        if (opt.getAttribute('aria-hidden') === 'true') return false;
        if (opt.hasAttribute('hidden')) return false;
        if (opt.closest('[aria-hidden="true"]')) return false;
        if (opt.getAttribute('aria-disabled') === 'true') return false;
        return true;
    });
};

// Match the target option, preferring an exact trimmed-text match and falling
// back to a case-insensitive substring (so "Petrol" still matches
// "Petrol / Electric" style rows).
const findOption = (options, optionText) => {
    const value = optionText ? String(optionText).trim() : '';
    if (!value) return null;
    const q = value.toLowerCase();
    return (
        options.find((opt) => opt.textContent.trim().toLowerCase() === q) ||
        options.find((opt) => opt.textContent.toLowerCase().includes(q))
    );
};

// FB's combobox rows often select on mousedown, and rows inside the menu's
// max-height scroller must be brought into view before they will accept input.
// Mirror the sequence the location autosuggest already uses successfully.
const clickOption = (opt) => {
    opt.scrollIntoView({ block: 'nearest' });
    opt.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
    opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    opt.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
};

// Handle Facebook's custom Dropdowns
export const handleDropdown = async (labelName, optionText, shouldAbort) => {
    if (shouldAbort?.()) return;
    const label = findLabelByText(labelName);
    if (!label) return console.log(`Skipping ${labelName}: Field not found.`);

    label.click();
    // Menu mounting is async, so never trust a single snapshot — poll a
    // short window re-querying the menu until the target (or "Other") shows.
    let options = collectVisibleOptions();
    let target = findOption(options, optionText);
    const other = (opts) =>
        opts.find((opt) => {
            const text = opt.textContent.trim().toLowerCase();
            return text === 'other' || text.startsWith('other ');
        });
    let otherOption = other(options);
    const hasValue = Boolean(optionText && String(optionText).trim());

    const openedAt = Date.now();
    const deadline = openedAt + 3000;
    while (!target && !otherOption && Date.now() < deadline) {
        if (shouldAbort?.()) return;
        await sleep(200);
        options = collectVisibleOptions();
        target = findOption(options, optionText);
        otherOption = other(options);
        // The menu never opened: if nothing has ever rendered after 1.2s, bail
        // instead of burning the whole window on a field with no options.
        if (!options.length && Date.now() - openedAt > 1200) break;
    }
    if (shouldAbort?.()) return;

    if (target) {
        console.log(`Selecting "${String(optionText)}" for ${labelName}.`);
        clickOption(target);
        await sleep(500);
        return;
    }

    // No REST-API value, or no matching option in the menu — select "Other"
    // instead of leaving the dropdown untouched.
    if (otherOption) {
        console.log(`No "${optionText || ''}" option for ${labelName} — selecting "Other".`);
        clickOption(otherOption);
        await sleep(500);
    } else if (hasValue) {
        console.log(`No matching "${optionText}" option for ${labelName}.`);
    }
};

// handle location dropdown
export const handleAutosuggestDropdown = async (locationText, shouldAbort) => {
    if (!locationText) return;
    if (shouldAbort?.()) return;
    const label = findLabelByText('Location');
    const input = label?.querySelector('input');
    if (!input) return;

    // Type the full location character by character
    input.focus();
    input.value = "";
    for (let i = 0; i < locationText.length; i++) {
        if (shouldAbort?.()) return;
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

    // If no suggestions, try shorter text
    let currentText = locationText;
    while (options.length === 0 && currentText.length > 2) {
        if (shouldAbort?.()) return;
        currentText = currentText.slice(0, -1);
        input.value = currentText;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(1000);
        options = findSuggestions();
    }

    // If we found suggestions, select
    if (options.length > 0) {
        const firstOpt = options[0];
        const targetSpan = firstOpt.querySelector('span') || firstOpt;
        const optText = firstOpt.textContent?.trim();
        console.log('Clicking option span:', optText?.substring(0, 30));
        
        // Ensure the menu container is visible and active
        const listbox = firstOpt.closest('[role="listbox"]');
        if (listbox) {
            listbox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        }

        // Force a sequence of events directly on the span
        targetSpan.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
        targetSpan.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        targetSpan.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        targetSpan.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        
        await sleep(1000); // Wait longer to ensure React processes the click
        
        // Remove manual input.value assignment to let React handle it naturally
        input.blur(); // Trigger final validation

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
    // const spans = Array.from(document.querySelectorAll('span'));
    // const target = spans.find(s => s.textContent.trim().toLowerCase().includes(labelText.toLowerCase()));
    // const label = target?.closest('label');
    const input = document?.querySelector('input[type="checkbox"]');
    
    if (input && !input.checked) {
        input.click();
        await sleep(300);
    }
};

// Handle Photo Uploads (via DataTransfer)
export const handlePhotos = async (urls, shouldAbort) => {
    if (!urls || urls.length === 0) return;
    if (shouldAbort?.()) return;
    const fileInput = document.querySelector('input[type="file"][accept*="image"]');
    if (!fileInput) return;

    const dataTransfer = new DataTransfer();
    for (const url of urls) {
        if (shouldAbort?.()) return;
        try {
            const file = await fetchImageAsFile(url, shouldAbort);
            if (file) dataTransfer.items.add(file);
        } catch (e) {
            console.error("Image fetch failed", e);
        }
    }
    if (shouldAbort?.()) return;
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
};

// Download one image and convert it to a File for the upload input.
// A plain CORS fetch works when the bucket sends Access-Control-Allow-Origin.
// `mode: 'no-cors'` can never work here — it yields an "opaque" response whose
// body cannot be read. When CORS blocks the plain fetch, the bytes are fetched
// through the extension background, which can request a host permission for the
// image origin once and then read the response regardless of the bucket's
// CORS config. If every path fails, a locally-drawn placeholder is returned so
// the listing can still be published and reviewed.
async function fetchImageAsFile(url, shouldAbort) {
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        return new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' });
    } catch (contentError) {
        if (shouldAbort?.()) return null;
    }
    try {
        const res = await browser.runtime.sendMessage({ type: 'FETCH_IMAGE', url });
        if (res?.success && res?.bytes) {
            const name = url.split('/').pop() || 'image.jpg';
            return new File([new Uint8Array(res.bytes)], name, {
                type: res.contentType || 'image/jpeg',
            });
        }
    } catch (bgError) {
        console.warn('Background image fetch failed:', bgError?.message || bgError);
    }
    console.warn(`Image unavailable (${url}) — using placeholder.`);
    return createPlaceholderFile();
}

// Placeholder image drawn on a local canvas. No network and no CORS involved,
// so it always succeeds — lets the automation publish a listing whose image
// URLs are unreachable so the flow can be reviewed end-to-end.
function createPlaceholderFile() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.font = '32px sans-serif';
    ctx.fillText('Image unavailable', canvas.width / 2, canvas.height / 2);
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(new File([blob], 'placeholder.png', { type: 'image/png' }));
            } else {
                console.error('Failed to create placeholder image.');
                resolve(null);
            }
        }, 'image/png');
    });
}