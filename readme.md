### Copy the Listing ID

Click the first selector: ``` div[aria-label^="More options for"] ```.

THen it opens a modal, the modal contains a bunch of links / menu, you can get them by this selector ``` div[aria-label="More options for listing"] a[role="menuitem"] ``` . 
Here is an example of the url of a menu https://www.facebook.com/marketplace/edit/?listing_id=1440733751253873&__tn__=!%3AG

Now here what i want you to do is extract the listing_id, we will send this to the csv export, yeah?