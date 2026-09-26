// vai ekhane first code ta postMessage send er jonno, second line ta optional but better to have. second line er kaj hosse apni dealercore e instant acknowledgemenet paben je extension data pailo kina. 

//  Send the data to extension
window.postMessage(
  {
    source: "FB_AUTOMATOR_FEED", // souce is required for security
    type: "FB_AUTOMATOR_ADD_VEHICLES", // type is required for identification of action
    items: items, // actual data items
  },
  "*",
);

// Acknowledge that extension got the data

window.addEventListener("message", function (event) {
  var d = event.data;

  // verify the source first
  if (!d || d.source !== "FB_AUTOMATOR_FEED") return;

  // check the response type from post message
  if (d.type !== "FB_AUTOMATOR_FEED_RESULT") return;
  
  // acknowlege ok
  if (d.ok) {
    // d.added; get the number of items appended
    // d.total; get the total items now
    
    // let me know if you need any more additional information other than added and total in post message
    // acknoeledgemenet response
  } else {
    // get the error in d.error
  }
});