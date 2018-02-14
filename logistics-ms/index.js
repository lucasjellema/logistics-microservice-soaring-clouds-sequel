
var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var model = require("./model/model");
var http = require('http');

var PORT = process.env.APP_PORT || 8096;
var APP_VERSION = "0.0.3"
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
    res.write("<h3>About "+APP_NAME+", Version " + APP_VERSION + "</h3><br/>");
    res.write("Supported URLs:<br/>");
    res.write("/shipping (POST)<br/>");
    res.write("/shipping/validate (POST)<br/>");
    res.write("/shipping/{shippingId} (GET)<br/>");
    res.write("/shipping/{shippingId} (DELETE)<br/>");
    res.write("/shipping/{shippingId}/status (GET)<br/>");
    res.write("/shipping/{shippingId}/cancel (POST)<br/>");
    res.write("/stock/{productIdentifier} (GET)<br/>");
    res.write("/health (GET)<br/>");
    res.write("NodeJS runtime version " + process.version + "<br/>");
    res.write("incoming headers" + JSON.stringify(req.headers) + "<br/>");
    res.write("Environment variables: DEMO_GREETING: "+ process.env.DEMO_GREETING + "<br/>");
    res.write("ELASTIC_CONNECTOR: "+ process.env.ELASTIC_CONNECTOR + "<br/>");
    res.end();
});


app.get('/shipping/:shippingId', function (req, res) {
    var shippingId = req.params['shippingId'];
    var shipping = {
        "id": shippingId,
        "orderIdentifier": "91839",
        "shippingStatus": "picking",
        "nameAddressee": "Mrs. K. Jones",
        "destination": {
            "country": "de",
            "street": "Bahnhofgasse",
            "houseNumber": "23a",
            "postalCode": "50768",
            "city": "Köln"
        },
        "shippingMethod": "premium",
        "desiredDeliveryDate": "2018-03-21",
        "giftWrapping": false,
        "personalMessage": "Ich denke, Sie werden diese Bücher wirklich genießen.",
        "items": [
            {
                "productIdentifier": "7623782376",
                "itemCount": 1
            },
            {
                "productIdentifier": "817AAXX918",
                "itemCount": 1
            }]
        , "parcels": [{
            "parcelDeliveryService": "UPS", "trackAndTraceIdentifier": "71276236II-123"
            , "estimatedDeliveryData": "2018-03-21", "parcelLogItems": [{ "location": "München", "parcelStatus": "inDepot", "estimatedDeliveryDate": "2018-02-21T17:32:28Z" }]
        }]
    };
    res.setHeader('Content-Type', 'application/json');
    res.send(shipping);
});

app.get('/shipping/:shippingId/status', function (req, res) {
    var shippingId = req.params['shippingId'];
    var status = { "status": "picking" };
    res.setHeader('Content-Type', 'application/json');
    res.send(status);
});

app.get('/stock/:productIdentifier', function (req, res) {
    var productIdentifier = req.params['productIdentifier'];
    var stockStatus = { "itemsInStock": Math.floor(Math.random()*2716)};
    res.setHeader('Content-Type', 'application/json');
    res.send(stockStatus);
});


app.post('/shipping/:shippingId/cancel', function (req, res) {
    var shippingId = req.params['shippingId'];
    if (Math.floor(Math.random() + 0.5) == 1) {
        var status = { "cancellationStatus": "shippingCannotBeCancelled" };
        res.setHeader('Content-Type', 'application/json');
        res.status(400);
        res.send(status);
    } else { res.send(202);}
});


app.delete('/shipping/:shippingId', function (req, res) {
    var shippingId = req.params['shippingId'];
    if (Math.floor(Math.random() + 0.5) == 1) {
        res.send(404);
    } else { res.send(204);}
});

app.post('/shipping', function (req, res) {
    var shipping = req.body;
    var shippingId = guid();
    shipping.shippingId = shippingId;
    shipping.shippingStatus = "new";
    res.setHeader('Content-Type', 'application/json');
    res.send(shipping);
});

app.post('/shipping/validate', function (req, res) {
    var shipping = req.body;
    var validation = {};
    if (Math.floor(Math.random() + 0.5) == 1) {
        var validation = {
            "status": "NOK"
            , "validationFindings": [{
                "findingType": "invalidDestination",
                "offendingItem": shipping.items[0]
            }
            ]
        };
    } else {
        var validation = {
            "status": "OK"
            , "validationFindings": [
            ]
        };
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(validation);
});


app.get('/health', function (req, res) {
    var health = { "status": "OK", "uptime": process.uptime() }
    res.setHeader('Content-Type', 'application/json');
    res.send(health);
});

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}