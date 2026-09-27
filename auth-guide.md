# Marketplace Extensions & Integrations Developer Guide

This document outlines how marketplace integrations (such as the Facebook Marketplace browser extension) interact with DealerCore.

---

## 1. Architecture Overview

A typical browser extension integration accomplishes three primary goals:
1. **Dynamic Environment Identification**: Seamlessly detect and adapt to whichever DealerCore domain the user is active on (`dealercore.com.au`, `dev.dealercore.com.au`, `beta.dealercore.com.au`, `staging.dealercore.com.au`, or local dev).
2. **Authentication**: Securely authenticate the user within the extension context using:
   - **Primary: Silent Web Session Handshake** (automatic zero-friction login when the user is logged into DealerCore).
   - **Backup Option: Interactive OAuth 2.0 Login** (fallback "Login with DealerCore" button used only if silent authentication fails).
3. **Synchronization & Write-back**: React to inventory additions and updates in real-time (via frontend `window.postMessage` bridge), retrieve canonical pre-formatted vehicle details, and report back the created Facebook Marketplace listing ID (`post_id` and `post_url`).

---

## 2. Multi-Environment & Domain Identification

DealerCore operates across multiple environments:
- **Production**: `https://dealercore.com.au`
- **Development**: `https://dev.dealercore.com.au`
- **Beta**: `https://beta.dealercore.com.au`
- **Staging**: `https://staging.dealercore.com.au`
- **Local Dev**: `http://dealercore.test` / `http://localhost:*`

To ensure the extension works across all environments without code changes, the extension identifies the current domain dynamically.

### Step 1: Wildcard Host Permissions (`manifest.json`)
Declare wildcard host permissions and content script matches in `manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "DealerCore Marketplace Assistant",
  "host_permissions": [
    "https://*.dealercore.com.au/*",
    "https://dealercore.com.au/*",
    "http://localhost/*",
    "http://*.test/*",
    "https://*.test/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://*.dealercore.com.au/*",
        "https://dealercore.com.au/*",
        "http://*.test/*",
        "https://*.test/*"
      ],
      "js": ["contentScript.js"]
    }
  ]
}
```

### Step 2: Content Script Auto-Detection (`contentScript.js`)
When injected into any DealerCore page, the content script reads `window.location.origin` and saves it to local extension storage:

```javascript
// Automatically resolves "https://dev.dealercore.com.au", "https://staging.dealercore.com.au", etc.
const currentDomain = window.location.origin;

// Cache active domain for extension popup and background service workers
chrome.storage.local.set({ dealercore_base_url: currentDomain });

// Perform silent handshake against the active domain
fetch(`${currentDomain}/api/v1/auth/handshake`, {
    method: 'POST',
    credentials: 'include'
})
.then(res => res.json())
.then(data => {
    if (data.status) {
        // Store the token associated with this specific environment
        chrome.storage.local.set({ [`token_${currentDomain}`]: data.access_token });
    }
});
```

### Step 3: Extension Popup / Background Script Domain Resolution
When the user opens the extension popup, inspect the active browser tab to determine the base URL dynamically:

```javascript
async function getDealerCoreBaseUrl() {
    // Check if the active tab is currently on a DealerCore domain
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url) {
        const url = new URL(tab.url);
        if (url.hostname.endsWith('dealercore.com.au') || url.hostname.endsWith('.test')) {
            const domain = url.origin;
            await chrome.storage.local.set({ dealercore_base_url: domain });
            return domain;
        }
    }

    // Fall back to cached domain from content script, or default to production
    const stored = await chrome.storage.local.get(['dealercore_base_url']);
    
    return stored.dealercore_base_url || 'https://dealercore.com.au';
}
```

---

## 3. Authentication

DealerCore provides **First-Party OAuth Clients** via Laravel Passport. First-party clients bypass user authorization/consent prompts, ensuring a seamless experience.

### Setting Up an OAuth Client
1. Log in to the DealerCore **Nova Admin Panel**.
2. Navigate to **Integrations > OAuth Clients**.
3. Create a new client (or use the pre-seeded development client):
   - **Name**: e.g., `Facebook Marketplace Extension`
   - **Redirect URIs**: Extension redirect URI (e.g. `https://<extension-id>.chromiumapp.org/` or `chrome-extension://*/oauth/callback`, plus `https://oauth.pstmn.io/v1/callback` for Postman testing).
   - **First Party**: Enable checkbox (sets `first_party = true`).
4. Save and copy the generated **Client ID**.

> [!NOTE]
> **Pre-Seeded Development Client**  
> For local development and testing, a first-party client is pre-seeded via `OAuthClientSeeder`:
> - **Client ID**: `9a5c8e32-2d14-41b9-8390-1c5c0a377755`
> - **Pre-registered Redirects**: `https://oauth.pstmn.io/v1/callback,chrome-extension://*/oauth/callback`
> - **Client Secret**: None (`null`, Public PKCE Client)

---

### Required Extension Credentials & Configuration

The extension only requires a single configuration constant to operate:

```javascript
// config.js
export const DEALERCORE_CONFIG = {
    // The First-Party OAuth Client ID (or pre-seeded dev ID: "9a5c8e32-2d14-41b9-8390-1c5c0a377755")
    CLIENT_ID: "9a5c8e32-2d14-41b9-8390-1c5c0a377755",

    // Default fallback domain
    DEFAULT_DOMAIN: "https://dev.dealercore.com.au"
};
```
*(Note: You **do not** need to bundle a `client_secret` in the extension).*

#### Runtime Credentials Lifecycle
| Flow / Action | Priority | Credentials Used | How They Are Obtained |
| :--- | :--- | :--- | :--- |
| **Silent Handshake** *(Auto-detect)* | **Primary Flow** | **Active Session Cookie** + `CLIENT_ID` | Automatically attached by the browser via `{ credentials: 'include' }` when the user is logged into DealerCore. Zero manual steps. |
| **Interactive OAuth** *(Popup Button)* | **Backup Option** | **User's Credentials** + `CLIENT_ID` | **Only used when Silent Handshake fails**. User clicks "Login with DealerCore" to authorize in a browser tab. |
| **Data Fetch & Write-Back** | **Runtime API** | **Bearer Access Token** | Generated by DealerCore during handshake/login and stored securely in `chrome.storage.local`. Sent as `Authorization: Bearer {token}`. |

---

### Flow A: Silent Web Session Handshake (Primary / Auto-Detect Login)
This is the **primary and preferred authentication mechanism**. When the extension's content script runs on an active DealerCore tab or checks authentication against the active domain, it silently acquires an API Bearer token by leveraging the user's active DealerCore session cookies with zero manual friction.

**Endpoint:** `POST {BASE_URL}/api/v1/auth/handshake` (also accepts `GET`)  
*Note: This route reads the active browser web session and performs origin verification.*

**Required Payload:**
```json
{
  "client_id": "YOUR_FIRST_PARTY_CLIENT_ID"
}
```
*(The `client_id` is strictly required to ensure the requesting client is a valid First-Party application).*

#### Success Response (Active Session, HTTP 200)
```json
{
  "status": true,
  "access_token": "eyJ0eXAiOiJKV1QiLCJ...",
  "token_type": "Bearer",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@dealership.com.au",
    "image": "http://dealercore.test/storage/images/user1.jpg"
  },
  "dealer": {
    "id": 7,
    "name": "Auto Star Prestige"
  },
  "branch": {
    "id": 2,
    "name": "Parramatta Yard",
    "state": "NSW",
    "image": null
  },
  "branches": [
    {
      "id": 2,
      "name": "Parramatta Yard",
      "state": "NSW",
      "image": null
    }
  ]
}
```

#### Unauthenticated Response (Guest Session, HTTP 401)
```json
{
  "status": false,
  "message": "Unauthenticated web session. Please log in to DealerCore first."
}
```

> [!IMPORTANT]
> **Fallback Trigger:** If the extension receives HTTP 401 from `/handshake` (indicating the user has no active DealerCore browser session or the session has expired), it prompts the user with the **"Login with DealerCore"** button to execute **Flow B** as a backup.

---

### Flow B: Interactive OAuth 2.0 Login (Backup / Fallback Option)

> [!WARNING]
> **Backup Option Only:** This flow is strictly a secondary fallback. The extension should **only** present or trigger the **"Login with DealerCore"** option when silent handshake authentication (**Flow A**) fails (e.g. unauthenticated HTTP 401 response).

Used when the user manually clicks the **"Login with DealerCore"** fallback button inside the extension popup or options page:

1. **Initiate Authorization**:
   Extension retrieves the active base URL and opens a browser tab or `chrome.identity.launchWebAuthFlow`:
   ```
   GET {BASE_URL}/oauth/authorize?client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&response_type=code&scope=
   ```
   *(e.g., `https://dev.dealercore.com.au/oauth/authorize?...`)*

2. **Guest Session Handling**:
   - If the user is **not logged in** to DealerCore, DealerCore redirects to the login screen (`/login`).
   - After successful login, DealerCore automatically resumes the OAuth flow.

3. **Auto-Approval**:
   - Because the client is marked as `First Party`, the consent prompt is bypassed automatically.
   - DealerCore immediately redirects back to `{REDIRECT_URI}?code={AUTHORIZATION_CODE}`.

4. **Exchange Code for Access Token**:
   Extension background script performs a POST request:
   ```http
   POST {BASE_URL}/oauth/token
   Content-Type: application/json

   {
     "grant_type": "authorization_code",
     "client_id": "YOUR_CLIENT_ID",
     "redirect_uri": "YOUR_REDIRECT_URI",
     "code": "AUTHORIZATION_CODE",
     "code_verifier": "CODE_VERIFIER"
   }
   ```
   *(Note: For public clients using PKCE, pass `code_verifier` instead of `client_secret`).*
   **Response:**
   ```json
   {
     "token_type": "Bearer",
     "expires_in": 315360000,
     "access_token": "eyJ0eXAiOiJKV1QiLCJ...",
     "refresh_token": "def50200..."
   }
   ```

5. **Refreshing Tokens (`grant_type: refresh_token`)**:
   When an OAuth access token expires or requires renewal, the extension sends the stored `refresh_token` to `POST /oauth/token` without prompting the user:
   ```http
   POST {BASE_URL}/oauth/token
   Content-Type: application/json

   {
     "grant_type": "refresh_token",
     "refresh_token": "YOUR_STORED_REFRESH_TOKEN",
     "client_id": "YOUR_CLIENT_ID"
   }
   ```
   *(Note: For public clients, `client_secret` is not required).*

   **Response (HTTP 200):**
   ```json
   {
     "token_type": "Bearer",
     "expires_in": 315360000,
     "access_token": "eyJ0eXAiOiJKV1QiLCJ...",
     "refresh_token": "def50200..."
   }
   ```

   > [!IMPORTANT]
   > **Refresh Token Rotation:** Laravel Passport returns a **newly rotated `refresh_token`** alongside the new `access_token`. The extension **must update** both values in `chrome.storage.local`. The previous refresh token cannot be reused.
   >
   > *(Reminder: This refresh flow only applies to tokens issued via Flow B. Flow A handshake tokens do not use `POST /oauth/token` or refresh tokens).*

---

### Validating Authenticated Context (`/me`)
Verify the active Bearer token and fetch the current user's profile and assigned yards:

**Endpoint:** `GET {BASE_URL}/api/v1/auth/me`  
**Headers:** `Authorization: Bearer {access_token}`

```json
{
  "status": true,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@dealership.com.au",
    "image": "http://dealercore.test/storage/images/user1.jpg"
  },
  "dealer": {
    "id": 7,
    "name": "Auto Star Prestige"
  },
  "branch": {
    "id": 2,
    "name": "Parramatta Yard",
    "state": "NSW",
    "image": null
  },
  "branches": [
    {
      "id": 2,
      "name": "Parramatta Yard",
      "state": "NSW",
      "image": null
    }
  ]
}
```

---

### Token Expiration & Renewal Lifecycle

| Flow / Scenario | Renewal Mechanism | Endpoint | How Renewal Works |
| :--- | :--- | :--- | :--- |
| **Flow A (Silent Handshake)** *(Primary)* | Active Browser Session Cookie | `POST /api/v1/auth/handshake` | **No refresh token needed**. Re-calling handshake with `{ credentials: 'include' }` reads active cookies and issues a fresh 1-year token seamlessly. |
| **Flow B (Interactive OAuth)** *(Backup)* | OAuth Refresh Token Grant | `POST /oauth/token` (`grant_type: "refresh_token"`) | Exchange stored `refresh_token` for a new token pair. Rotates `refresh_token` (store the newly returned one). |
| **Token Expired / 401 Received** | Fallback Chain | 1. `POST /handshake`<br>2. `POST /oauth/token`<br>3. "Login with DealerCore" | Try silent handshake first. If that fails, try OAuth refresh token. If both fail (user logged out of DealerCore), prompt the user with "Login with DealerCore". |

---

## 4. Event Bridge (Frontend Synchronization)

When a dealer creates or edits a vehicle in DealerCore (e.g. at `/admin/stock/car/edit/{id}` or during the stock entry wizard), the DealerCore frontend emits a `window.postMessage` event containing the **fully prepared vehicle payload**.

Extension content scripts listen for this event to immediately offer posting or updating without requiring manual API polling.

### Event Listener Example (Content Script)

```javascript
window.addEventListener("message", (event) => {
    // Verify origin for security (matches active origin or *.dealercore.com.au)
    const isDealerCore = event.origin === window.location.origin && 
        (window.location.hostname.endsWith('dealercore.com.au') || 
            window.location.hostname.endsWith('.test') || 
            window.location.hostname === 'localhost');

    if (!isDealerCore) {
        return;
    }

    // Identify DealerCore extension events
    if (event.data && event.data.source === 'DEALERCORE_FB_EXTENSION') {
        switch (event.data.type) {
            case 'STOCK_FOR_ADVERTISING':
                const vehicle = event.data.payload;
                const vehicleId = vehicle.id;
                const listingStatus = vehicle.status; // 'post' (new) | 'update' (already posted)

                console.log(`Vehicle ${vehicleId} ready for marketplace. Status: ${listingStatus}`);

                // Send vehicle payload directly to extension background worker or UI
                chrome.runtime.sendMessage({
                    action: 'TRIGGER_MARKETPLACE_SYNC',
                    vehicle: vehicle
                });
                
                break;

            default:
                break;
        }
    }
});
```

---

## 5. Vehicle Data Retrieval API

If the extension needs to fetch or refresh inventory, it queries the dedicated Facebook Marketplace endpoint.

**Endpoint:** `GET {BASE_URL}/api/v1/facebook-marketplace/vehicles`  
**Headers:** `Authorization: Bearer {access_token}`

### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `status` | string | `null` | Optional filter: `"post"` (unlisted), `"update"` (modified since last sync), or omit for all. |
| `branch_id` | integer | `null` | Optional filter: yard/branch ID. |
| `page` | integer | `1` | Page number for pagination. |
| `per_page` | integer | `25` | Vehicles returned per page. |

### Response Structure

```json
{
  "status": true,
  "data": [
    {
      "id": 105,
      "status": "post",
      "facebook": {
        "account_id": "",
        "post_id": "",
        "post_url": ""
      },
      "details": {
        "year": 2022,
        "make": "Toyota",
        "model": "RAV4",
        "badge": "GXL",
        "series": "52R",
        "body_style": "SUV",
        "body_type": "SUV",
        "mileage": 35000,
        "odometer": 35000,
        "odometer_unit": "km",
        "price": 38990,
        "condition": "Excellent",
        "fuel_type": "Hybrid",
        "transmission": "Automatic transmission",
        "transmission_type": "Auto",
        "colour": "Crystal Pearl",
        "vin": "JTM4RFV30XXXXXX",
        "registration_no": "ABC1234",
        "registration_state": "NSW",
        "registration_expiry": "2027-06-30"
      },
      "pricing": {
        "price": 38990,
        "advertised_price": 38990,
        "discount_price": null,
        "price_type": "Drive Away"
      },
      "description": "2022 Toyota RAV4 GXL Hybrid\r\n\r\nCompetitive finance packages available to approved applicants.\r\n\r\n#Toyota #RAV4 #CarsForSale\r\n\r\nEnquire with our dealership today!",
      "description_templates": {
        "title": "2022 Toyota RAV4 GXL Hybrid",
        "features": "",
        "comments": "",
        "offering": "Competitive finance packages available to approved applicants.",
        "warranty": "Statutory warranty and extended warranty options available.",
        "tags": "#Toyota #RAV4 #CarsForSale",
        "signature": "Enquire with our dealership today!"
      },
      "images": [
        "https://cdn.dealercore.com.au/vehicles/105/image-1.jpg",
        "https://cdn.dealercore.com.au/vehicles/105/image-2.jpg"
      ],
      "timestamps": {
        "vehicle_updated_at": "2026-09-26T10:00:00.000000Z",
        "last_synced_at": null
      }
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "per_page": 25,
    "pending_post_count": 12,
    "pending_update_count": 4
  }
}
```

---

### Facebook Marketplace Field Mapping Reference

DealerCore automatically standardizes vehicle details into Facebook Marketplace dropdown values:

| Required Attribute | JSON Key | Format / Permitted Values |
| :--- | :--- | :--- |
| **Year** | `details.year` | Integer (e.g. `2022`) |
| **Make** | `details.make` | String (e.g. `"Toyota"`) |
| **Model** | `details.model` | String (e.g. `"RAV4"`) |
| **Mileage** | `details.mileage` (or `details.odometer`) | Integer (e.g. `35000`) |
| **Price** | `pricing.price` (or `pricing.advertised_price`) | Float / Number (e.g. `38990`) |
| **Body Style** | `details.body_style` (or `details.body_type`) | String (e.g. `"SUV"`, `"Sedan"`, `"Hatchback"`, `"Ute"`) |
| **Condition** | `details.condition` | Pre-mapped to FB dropdown: `"Excellent"`, `"Very Good"`, `"Good"`, `"Fair"`, `"Poor"` |
| **Fuel Type** | `details.fuel_type` | Pre-mapped to FB dropdown: `"Petrol"`, `"Diesel"`, `"Electric"`, `"Hybrid"`, `"Flex"`, `"Other"` |
| **Transmission** | `details.transmission` | Pre-mapped to FB dropdown: `"Automatic transmission"`, `"Manual transmission"` |
| **Description** | `description` | Full formatted string containing rendered title, features, disclaimers, hashtags, and dealer signature |
| **Images** | `images` | Array of absolute image URLs (**strictly capped at max 20 images**) |

---

## 6. Sync Tracking (Write-back API)

Once the extension successfully creates, updates, or encounters a failure listing a vehicle on Facebook Marketplace, it posts the result back to DealerCore.

**Endpoint:** `POST {BASE_URL}/api/v1/facebook-marketplace/vehicles`  
**Headers:** `Authorization: Bearer {access_token}`

### Payload

```json
{
  "vehicle_id": 105,
  "status": "created",
  "account_id": "1000849204123",
  "post_id": "1829401829481",
  "post_url": "https://www.facebook.com/marketplace/item/1829401829481/",
  "message": null
}
```

### Parameter Specification
- `vehicle_id` *(required, integer)*: DealerCore Vehicle ID.
- `status` *(required, string)*: `"created"` (initial post), `"updated"` (listing updated), or `"failed"`.
- `account_id` *(optional, string)*: Facebook profile/account UID used to post.
- `post_id` *(optional, string)*: Facebook Marketplace listing ID.
- `post_url` *(optional, string)*: Direct URL to the Facebook listing.
- `message` *(optional, string)*: Error or status note (e.g. when status is `"failed"`).

### Response (HTTP 200)

```json
{
  "status": true,
  "message": "Vehicle Facebook Marketplace status updated successfully.",
  "data": {
    "id": 105,
    "status": "synced",
    "facebook": {
      "account_id": "1000849204123",
      "post_id": "1829401829481",
      "post_url": "https://www.facebook.com/marketplace/item/1829401829481/"
    },
    "details": { ... },
    "pricing": { ... },
    "description": "...",
    "images": [ ... ],
    "timestamps": {
      "vehicle_updated_at": "2026-09-26T10:00:00.000000Z",
      "last_synced_at": "2026-09-26T10:28:00.000000Z"
    }
  }
}
```

---

## 7. Security Rules & Best Practices for Developers

Developing browser extensions introduces unique security boundaries between the browser sandbox, open web pages, and backend APIs. Adhere to the following rules:

### 1. Token Storage Isolation: `chrome.storage.local` vs `window.localStorage`
> [!CAUTION]
> **Rule of Thumb:** NEVER store DealerCore Bearer access tokens in the page's `window.localStorage` or `sessionStorage`.

* **The Vulnerability:** Any JavaScript code executing on a web page (including third-party scripts, advertising widgets, and analytics libraries) can read `window.localStorage`. Storing your OAuth Bearer token there exposes your users' entire DealerCore account to token theft.
* **The Solution:** Always store the Bearer token in **`chrome.storage.local`**.
  * `chrome.storage.local` is strictly isolated within the extension sandbox.
  * Webpages (neither Facebook, DealerCore, nor external websites) have access to `chrome.storage.local`. Only your extension's own background service workers, content scripts, and popup can access it.

```javascript
// ✅ CORRECT: Securely isolated to extension sandbox
await chrome.storage.local.set({ [`token_${currentDomain}`]: data.token });

// ❌ FORBIDDEN: Readable by third-party scripts on the page
window.localStorage.setItem('dealercore_token', data.token);
```

---

### 2. Client ID & Client Secret in Public Clients (Browser Extensions)
Browser extensions are classified as **Public Clients** (RFC 6749 Section 2.1) because their package (`.crx`) runs on the end user's machine and can be unpacked and inspected.

* **Can a hacker steal the `client_id` or `client_secret` from extension code?**
  * Yes, any string compiled or bundled into extension JavaScript can be extracted by opening DevTools.
  * For this reason, **client secrets cannot be trusted as confidential** in client-side applications.
* **How DealerCore secures OAuth without relying on a secret:**
  1. **Strict Redirect URI Whitelisting**:
     Even if an attacker knows your `client_id`, the OAuth authorization code can **only** be returned to the exact registered redirect URI (e.g. `https://<your-extension-id>.chromiumapp.org/`). An attacker cannot divert the login code to their own server.
  2. **PKCE (Proof Key for Code Exchange - RFC 7636)**:
     Instead of a hardcoded shared secret, extensions can use dynamic PKCE verification (`code_challenge` / `code_verifier`). Each login transaction generates a one-time cryptographic secret in memory.
  3. **First-Party Client Verification**:
     Only clients explicitly approved as **First Party** in the DealerCore Nova Admin Panel are permitted to bypass user consent prompts.

---

### 3. Cross-Site Protection on Silent Handshake (`/api/v1/auth/handshake`)
The silent handshake endpoint exchanges an active browser session for a Bearer token. To prevent cross-site token theft (CSRF / malicious sites attempting to read tokens):

* **Browser Metadata Guard (`Sec-Fetch-Site`)**:
  DealerCore inspects the `Sec-Fetch-Site` HTTP header. If a request is initiated cross-site (e.g. a user visits `evil-site.com` while logged in to DealerCore), the browser automatically labels the request as `Sec-Fetch-Site: cross-site`. DealerCore immediately rejects it with **HTTP 403 Forbidden**.
* **Origin Whitelisting**:
  DealerCore verifies that the `Origin` header matches approved DealerCore domains (`*.dealercore.com.au`, local development hosts, or `chrome-extension://`).
* **Why Postman differs from a Browser**:
  Postman allows setting arbitrary headers because it is an HTTP testing tool running outside a browser. However, Postman cannot perform an attack against your users because Postman does **not** possess the user's private browser session cookies (`laravel_session`). The handshake strictly requires an authenticated session.

---

### 4. Permission & Multi-Branch Scoping
* **Dealership Isolation**: All API requests are scoped to the authenticated user's dealership (`$dealerId`).
* **Branch Permissions**: Staff members are limited to viewing and updating vehicles in their assigned yards. Any attempt to write back status for a vehicle outside their assigned branches returns **HTTP 403 Unauthorized**.
* **Dealership Status**: If a dealership is suspended or dormant, all API calls are automatically blocked by the `dealer.status` middleware.

---

## 8. Rate Limiting & HTTP 429 Handling

To protect dealership data, prevent database token saturation, and maintain infrastructure stability, DealerCore enforces automated rate limits across `/api/v1` routes:

### Active Rate Limits

| Route / Scope | Rate Limit | Middleware | Purpose |
| :--- | :--- | :--- | :--- |
| **Silent Handshake** (`/api/v1/auth/handshake`) | **30 requests / minute** | `throttle:30,1` | Prevents token database bloating and runaway extension check-in loops. |
| **Protected APIs** (`/vehicles`, `/me`, write-back) | **120 requests / minute** | `throttle:120,1` | Generous limit (2 req/sec) accommodating vehicle inventory fetching and sync write-backs. |

### Rate Limit Response Headers
Every API response includes standard HTTP rate limit headers:
* `X-RateLimit-Limit`: Maximum requests permitted within the 1-minute window.
* `X-RateLimit-Remaining`: Remaining request quota for the current window.
* `Retry-After`: Number of seconds to wait before making another request (sent when HTTP 429 is triggered).

### Handling HTTP 429 (Too Many Requests)
When an extension exceeds its quota, DealerCore responds with **HTTP 429 Too Many Requests**:

```json
{
  "message": "Too Many Attempts."
}
```

#### Best Practice Implementation (Extension Fetch Wrapper)
Extensions should implement a request wrapper with exponential backoff or honor the `Retry-After` header:

```javascript
async function fetchWithRateLimitRetry(url, options = {}, retries = 3) {
    const res = await fetch(url, options);

    if (res.status === 429 && retries > 0) {
        // Read Retry-After header (in seconds), fallback to 5 seconds
        const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
        console.warn(`[DealerCore API] Rate limited. Retrying after ${retryAfter}s...`);
        
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return fetchWithRateLimitRetry(url, options, retries - 1);
    }

    return res;
}
```
