import { browser } from 'wxt/browser';

// How a run is initiated from incoming postMessage (stock/feed) data:
//   manual → the user selects vehicles and clicks Publish (default, legacy).
//   auto   → the background starts publishing as soon as a stock event lands.
// The absent key means "manual", so existing installs are unaffected.
export const PUBLICATION_MODE_KEY = 'publication_automation';

export const PUBLICATION_MODE = {
  MANUAL: 'manual',
  AUTO: 'auto',
};

export async function getPublicationMode() {
  const data = await browser.storage.local.get([PUBLICATION_MODE_KEY]);
  return data[PUBLICATION_MODE_KEY] === PUBLICATION_MODE.AUTO
    ? PUBLICATION_MODE.AUTO
    : PUBLICATION_MODE.MANUAL;
}

export async function setPublicationMode(mode) {
  return browser.storage.local.set({
    [PUBLICATION_MODE_KEY]:
      mode === PUBLICATION_MODE.AUTO
        ? PUBLICATION_MODE.AUTO
        : PUBLICATION_MODE.MANUAL,
  });
}
