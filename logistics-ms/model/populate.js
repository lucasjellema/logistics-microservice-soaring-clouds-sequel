// through API - not directly to database

var request = require("request");
var LOGISTICS_MS = "http://129.213.11.15/soaring/logistics"

function createDrop() {
var options = { method: 'POST',
  url: `${LOGISTICS_MS}/products`,
  headers: 
   { 'Content-Type': 'application/json' },
  body: 
   { id: 'DROP-456',
     name: 'Drop, king size bag',
     weight: 1.2,
     dimension: { unit: 'cm', length: 15, height: 5, width: 5.4 },
     categories: [ 'food', 'sugar', 'vegan' ] },
  json: true };

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
}//createDrop

async function deliverDrop() {
var options = { method: 'POST',
  url: `${LOGISTICS_MS}/stock/DROP-456`,
  headers: 
   { 'Content-Type': 'application/json' },
  body: { quantityChange: 75, category: 'delivery' },
  json: true };

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
}//deliverDrop


async function createShipping() {
    var options = { method: 'POST',
      url: `${LOGISTICS_MS}/shipping`,
      headers: 
       { 'Content-Type': 'application/json' },
      body: {orderIdentifier: 'ZZXX123',
      nameAddressee: 'Jeanet Visser',
      destination: { country: 'nl', city: 'Stavoren' },
      shippingMethod: 'economy',
      giftWrapping: false,
      personalMessage: 'Enjoy this stuff.',
      items: 
       [ { productIdentifier: 'DROP-456',
           itemCount: 25 } ]},
      json: true };
    
    request(options, function (error, response, body) {
      if (error) throw new Error(error);
    
      console.log(body);
    });
}//createShipping
    

 createDrop()
 deliverDrop()
createShipping()