
var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var http = require('http');

// local modules
var shipping = require("./shipping.js");
var stock = require("./stock.js");
var jobs = require("./jobs.js");
var productEventListener = require("./ProductEventHubListener.js");
var util = require("./util");

var PORT = process.env.APP_PORT || 8096;
var APP_VERSION = "0.1.2"
var APP_NAME = "LogisticsMS"

console.log("Running " + APP_NAME + "version " + APP_VERSION);
var app = express();
var server = http.createServer(app);
server.listen(PORT, function () {
    console.log('Soaring through the Clouds - the Sequel Microservice' + APP_NAME + ' running, Express is listening... at ' + PORT + " for /health, /about and /shipping API calls");
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ type: '*/*' }));
app.get('/about', function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write("<h3>About " + APP_NAME + ", Version " + APP_VERSION + "</h3><br/>");
    res.write("Supported URLs:<br/>");
    res.write("/shipping (POST)<br/>");
    res.write("/shipping/validate (POST) - mock <br/>");
    res.write("/shipping/{shippingId} (GET)<br/>");
    res.write("/shipping/{shippingId} (DELETE) - mock<br/>");
    res.write("/shipping/{shippingId}/status (GET)<br/>");
    res.write("/shipping/{shippingId}/cancel (POST) - mock <br/>");
    res.write("/stock/{productIdentifier} (GET) - mock <br/>");
    res.write("/health (GET)<br/>");
    res.write("NodeJS runtime version " + process.version + "<br/>");
    res.write("incoming headers" + JSON.stringify(req.headers) + "<br/>");
    res.write("Environment variables: DEMO_GREETING: " + process.env.DEMO_GREETING + "<br/>");
    res.write("ELASTIC_CONNECTOR: " + process.env.ELASTIC_CONNECTOR + "<br/>");
    res.end();
});


app.get('/health', function (req, res) {
    var health = { "status": "OK", "uptime": process.uptime(),"version": APP_VERSION }
    res.setHeader('Content-Type', 'application/json');
    res.send(health);
});

shipping.registerAPIs(app);
stock.registerAPIs(app);

productEventListener.subscribeToEvents(
    (message) => {
        console.log("EventBridge: Received AVRO Product event from event hub");
        console.log(message)
        try {
            handleProductEventHubEvent(message);
        } catch (error) {
            console.log("failed to handle message from event hub", error);

        }

    }
);

async function handleProductEventHubEvent(message) {
    console.log("Event payload " + JSON.stringify(message));
    var event = {
        "eventType": "ProductEvent",
        "payload": {
            "productIdentifier": message.productId,
            "productCode": message.productCode.string,
            "productName": message.productName.string,
            // "imageUrl": message.imageUrl?message.imageUrl.string:null,
            // "price": message.price?message.price.double:null,
            // "size": message.size?message.size.int:null,
            // "weight": message.weight?message.weight.double:null,
            // "categories": message.categories,
            // "tags": message.tags,
            // "dimension": message.dimension? { 
            //     "unit": message.dimension.unit?message.dimension.unit.string:null,
            //     "length": message.dimension.length?message.dimension.length.double:null,
            //     "height": message.dimension.height?message.dimension.height.double:null,
            //     "width": message.dimension.width?message.dimension.width.double:null
            // }:null,
            "color": message.color?message.color.string:null
        
        }
        ,
        "module": "products.microservice",
        "transactionIdentifier": message.productId,
        "timestamp":util.getTimestampAsString
    }
    // store product details in Elastic Search Index products
    console.log('store product details in Elastic Search Index products for '+ JSON.stringify(event))

//    var result = await model.saveProductEvent(event);
}
