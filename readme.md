### Copy the Listing ID

Click the first selector: `div[aria-label^="More options for"]`.

THen it opens a modal, the modal contains a bunch of links / menu, you can get them by this selector `div[aria-label="More options for listing"] a[role="menuitem"]` .
Here is an example of the url of a menu https://www.facebook.com/marketplace/edit/?listing_id=1440733751253873&__tn__=!%3AG

Now here what i want you to do is extract the listing_id, we will send this to the csv export, yeah?

```
Server rejected the authorize request (HTTP 401) for client_id 9a5c8e32-2d14-41b9-8390-1c5c0a377755.

Server said "invalid_client": Client authentication failed. This is a server-side OAuth client registration problem, not a credential problem.

In Passport this exact response means the client row was not found OR "First Party" is still unchecked. Verify in Nova → Integrations → OAuth Clients that this exact UUID is First Party, active, has the Authorization Code grant, and lists the redirect URI https://cdjgjhdgomipcfgjjaklpioeamejcacf.chromiumapp.org/ (note the trailing slash).

```

### Save Draft Button implementation

selector: `div[aria-label="Save Draft"]`

## Api Endpoints

GET https://dev.dealercore.com.au/api/v1/auth/handshake?client_id=9a5c8e32-2d14-41b9-8390-1c5c0a377755

> JSON Response

```json
{
  "status": true,
  "access_token": "",
  "token_type": "Bearer",
  "user": {
    "id": 19,
    "name": "Abdullahil Arefin",
    "email": "abdullah.ashik.arefin@gmail.com",
    "image": null
  },
  "dealer": { "id": 19, "name": "Dealership" },
  "branch": {
    "id": 21,
    "name": "BIXCEL PTY LTD",
    "state": "VIC",
    "image": null
  },
  "branches": [
    { "id": 21, "name": "BIXCEL PTY LTD", "state": "VIC", "image": null }
  ]
}
```
