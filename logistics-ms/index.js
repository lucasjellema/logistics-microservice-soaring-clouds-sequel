
var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var http = require('http');
var cors = require('cors');
const logger = require('./logger'); //our logger module

// local modules
var shipping = require("./shipping.js");
var stock = require("./stock.js");
var jobs = require("./jobs.js");
var util = require("./util");

var PORT = process.env.APP_PORT || 8096;
var APP_VERSION = "0.1.14"
var APP_NAME = "LogisticsMS"

logger.log("info","Running " + APP_NAME + "version " + APP_VERSION+" on port "+PORT);
console.log("Running " + APP_NAME + "version " + APP_VERSION+" on port "+PORT);
var app = express();
//Enable CORS pre-flight in all operations
app.use(cors());
app.options('*', cors()); // include before other routes
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
    res.write("/shipping/shipping/forProduct/:productIdentifier (GET) <br/>")    
    res.write("/shipping/period/day (or week or month or year) (GET) <br/>")    
    res.write("/stock/{productIdentifier} (GET) - mock <br/>");
    res.write("/stock/{productIdentifier} (POST)  <br/>");
    res.write("/health (GET)<br/>");
    res.write("NodeJS runtime version " + process.version + "<br/>");
    res.write("incoming headers" + JSON.stringify(req.headers) + "<br/>");
    res.write("ELASTIC_CONNECTOR: " + process.env.ELASTIC_CONNECTOR + "<br/>");
    res.end();
});


app.get('/health', function (req, res) {
    var health = { "status": "OK", "uptime": process.uptime(),"version": APP_VERSION ,"message":"hello!"}
    res.setHeader('Content-Type', 'application/json');
    res.send(health);
});

shipping.registerAPIs(app);
stock.registerAPIs(app);

