import { sleep } from "./sleep";

// Simulate human typing
export const typeLikeHuman = async (input, text) => {
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