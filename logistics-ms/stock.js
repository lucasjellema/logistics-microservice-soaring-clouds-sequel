
var util = require("./util");
var model = require("./model/model");
var eventBusPublisher = require("./EventPublisher.js");

var APP_VERSION = "0.0.4"
var APP_NAME = "Stock"

var stock = module.exports;


console.log("Running Module " + APP_NAME + " version " + APP_VERSION);

stock.registerAPIs = function (app) {


    app.get('/stock/:productIdentifier', async function (req, res) {
        var productIdentifier = req.params['productIdentifier'];
        var stocks = await model.retrieveProductStock([productIdentifier])

        var stockStatus = { "itemsInStock": stocks[productIdentifier] ? stocks[productIdentifier] : 0 };
        res.setHeader('Content-Type', 'application/json');
        res.send(stockStatus);
    });

    app.get('/products', async function (req, res) {
        try {
            var productsResult = await model.retrieveProducts();
            res.setHeader('Content-Type', 'application/json');
            console.log("Products " + JSON.stringify(productsResult))
            // create an array of products - removing all Elastic Search specific properties
            var products =
                productsResult.hits.hits.reduce(function (products, item) {
                    products.push(item._source)
                    return products
                }, [])
            res.send(products);
        } catch (e) {
            res.send(404);
        }
    });
    app.get('/products/:productIdentifier', async function (req, res) {
        var productIdentifier = req.params['productIdentifier'];
        var stock = await model.retrieveProductStock([productIdentifier], true)
        try {
            var productsResult = await model.retrieveProducts([productIdentifier]);
            res.setHeader('Content-Type', 'application/json');
            console.log("Products " + JSON.stringify(productsResult))
            // create an array of products - removing all Elasic Search specific properties
            var products =
                productsResult.hits.hits.reduce(function (products, item) {
                    products.push(item._source)
                    return products
                }, [])
            if (products.length == 0) {
                res.send(404);
                return;
            }
            var product = products[0];
            product.stockStatus = stock[productIdentifier] ? stock[productIdentifier] : 0;
            product.stockTransactions = stock.transactions;
            res.send(product);
        } catch (e) {
            res.send(404);
        }
    });

    app.post('/products', async function (req, res) {
        try {
            var product = req.body;
            var result = await model.saveProduct(product);
            res.setHeader('Content-Type', 'application/json');
            res.send(product);

        } catch (e) {
            res.send(404);
        }
    });//post product

    app.post('/stock/:productIdentifier', async function (req, res) {
            var productIdentifier = req.params['productIdentifier'];
        try {
            // {
            //     , "quantityChange": quantity
            //     , "category": "replenish"  //damaged, lost, correction, discarded, stolen
            // })
            var stocktransaction = req.body;
            stocktransaction.productIdentifier = productIdentifier
            stocktransaction.timestamp = util.getTimestampAsString()
            var result = await model.saveProductStockTransaction(stocktransaction);
            res.setHeader('Content-Type', 'application/json');
            res.send(result);

        } catch (e) {
            res.send(404);
        }
    });//post stocktransaction


}

