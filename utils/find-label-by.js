// Find the label wrapper by checking all spans for matching text
export const findLabelByText = (text) => {
    const spans = Array.from(document.querySelectorAll('label div span'));
    const target = spans.find(s => s.textContent.trim().toLowerCase() === text.toLowerCase());
    return target?.closest('label') || null;
};