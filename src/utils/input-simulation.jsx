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

// Simulate mouse click with proper events
export const clickElement = async (element) => {
    if (!element) return;
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

    console.log('Click success');
    await sleep(200);
};