chrome.runtime.onInstalled.addListener(() => {
  console.log("FB Automator Extension Installed");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "NAVIGATE_TO_CREATE") {
    chrome.tabs.update(sender.tab.id, {
      url: "https://www.facebook.com/marketplace/create/vehicle",
    });
  }
});
