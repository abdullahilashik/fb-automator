const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// --- HELPERS ---

// Find the label wrapper by checking all spans for matching text
const findLabelByText = (text) => {
    const spans = Array.from(document.querySelectorAll('span'));
    const target = spans.find(s => s.textContent.trim().toLowerCase() === text.toLowerCase());
    return target?.closest('label') || null;
};

// Simulate human typing
const typeLikeHuman = async (input, text) => {
    if (!input) return;
    input.focus();
    input.value = "";
    for (let char of text.toString()) {
        input.value += char;
        input.dispatchEvent(new InputEvent('input', { bubbles: true, data: char }));
        await sleep(Math.random() * 40 + 20);
    }
    input.dispatchEvent(new Event('change', { bubbles: true }));
};

// Handle Facebook's custom Dropdowns
const handleDropdown = async (labelName, optionText) => {
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
const handleLocation = async (locationText) => {
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

// Handle Photo Uploads (via DataTransfer)
const handlePhotos = async (urls) => {
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

// --- MAIN EXECUTION ---

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "START_AUTOMATION") {
        const item = request.payload;

        // 1. Vehicle Type
        await handleDropdown('Vehicle type', item.vehicleType);

        // 2. Photos
        await handlePhotos(item.imageUrls);

        // 3. Location
        await handleLocation(item.location);

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
            }
        }

        // 5. Dropdowns
        await handleDropdown('Year', item.year);
        await handleDropdown('Fuel type', item.fuelType);
        await handleDropdown('Transmission', item.transmission);
        await handleDropdown('Body style', item.bodyStyle);
        await handleDropdown('Vehicle condition', item.condition);

        // 6. Description (Textarea)
        const descContainer = findLabelByText('Description');
        const textarea = descContainer?.querySelector('textarea');
        if (textarea) {
            await typeLikeHuman(textarea, item.description);
        }

        console.log("Automation Complete");
        sendResponse({ status: "Complete" });
    }
    return true;
});