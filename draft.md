

#### Option 1: On-Demand Focus / Action Trigger (Zero Idle Overhead)

Instead of continuous background checking, check state **only when the user interacts** with your web app (e.g., when the window regains focus, or when a user clicks an action button like "Connect Extension").

* **Extension (`entrypoints/content.ts`):**
```typescript
export default defineContentScript({
  matches: ['https://yourwebsite.com/*'],
  run_at: 'document_start',
  main() {
    // Respond immediately whenever the site asks
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'PING_EXTENSION') {
        window.postMessage({ type: 'PONG_EXTENSION' }, '*');
      }
    });
  },
});

```


* **Website:**
```javascript
async function checkExtensionLive(timeoutMs = 100) {
  return new Promise((resolve) => {
    const handleMessage = (event) => {
      if (event.data?.type === 'PONG_EXTENSION') {
        window.removeEventListener('message', handleMessage);
        clearTimeout(timer);
        resolve(true);
      }
    };

    window.addEventListener('message', handleMessage);

    const timer = setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      resolve(false);
    }, timeoutMs);

    window.postMessage({ type: 'PING_EXTENSION' }, '*');
  });
}

// Check state only when tab becomes visible again or user interacts
window.addEventListener('focus', async () => {
  const isLive = await checkExtensionLive();
  console.log("Extension live status on tab focus:", isLive);
});

```



#### Option 2: Full Page Reload

Accept that if a user installs or uninstalls the extension while sitting on your site, the state syncs when they refresh or navigate to a new route. Content scripts run automatically at `document_start` on fresh navigations.
