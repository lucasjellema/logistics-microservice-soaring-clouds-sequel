
var util = require("./util");
var model = require("./model/model");
var eventBusPublisher = require("./EventPublisher.js");

var APP_VERSION = "0.0.1"
var APP_NAME = "Stock"

var stock = module.exports;


console.log("Running Module " + APP_NAME + " version " + APP_VERSION);

stock.registerAPIs = function (app) {


    app.get('/stock/:productIdentifier', function (req, res) {
        var productIdentifier = req.params['productIdentifier'];
        var stockStatus = { "itemsInStock": Math.floor(Math.random() * 2716) };
        res.setHeader('Content-Type', 'application/json');
        res.send(stockStatus);
    });
    
    app.get('/products', async function (req, res) {
        try {
        var products= await model.retrieveProducts();
            res.setHeader('Content-Type', 'application/json');
            console.log("Products "+JSON.stringify(products))
            res.send(products.hits.hits);
        } catch(e) {
            res.send(404);
    }});
}

