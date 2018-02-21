
const Nominatim = require('nominatim-geocoder')
const geocoder = new Nominatim({}, {
    format: 'json',
    limit: 3
})

var util = require("./util");
var model = require("./model/model");
var eventBusPublisher = require("./EventPublisher.js");

var APP_VERSION = "0.0.4"
var APP_NAME = "Shipping"

var shipping = module.exports;


console.log("Running Module " + APP_NAME + " version " + APP_VERSION);

shipping.registerAPIs = function (app) {

    app.get('/shipping/:shippingId', function (req, res) {
        var shippingId = req.params['shippingId'];
        /*   var shipping = {
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
           */
        model.retrieveShipping(shippingId).then((result) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(result._source);

        }).catch(function (e) {
            res.send(404);
        })
    });

    app.get('/shipping/:shippingId/status', function (req, res) {
        var shippingId = req.params['shippingId'];
        model.retrieveShipping(shippingId).then((result) => {
            res.setHeader('Content-Type', 'application/json');
            var status = { "status": result._source.shippingStatus };
            res.send(status);
        }).catch(function (e) {
            res.send(404);
        })
    });

    app.post('/shipping/:shippingId/cancel', function (req, res) {
        var shippingId = req.params['shippingId'];
        if (Math.floor(Math.random() + 0.5) == 1) {
            var status = { "cancellationStatus": "shippingCannotBeCancelled" };
            res.setHeader('Content-Type', 'application/json');
            res.status(400);
            res.send(status);
        } else {
            res.send(202);
        }
    });


    app.delete('/shipping/:shippingId', function (req, res) {
        var shippingId = req.params['shippingId'];
        if (Math.floor(Math.random() + 0.5) == 1) {
            res.send(404);
        } else { res.send(204); }
    });


    app.post('/shipping', async function (req, res) {
        var shipping = req.body;
        var validationResult = await validateShipping(shipping)
        if (validationResult.status=="NOK") {
            res.setHeader('Content-Type', 'application/json');
            res.status(400);
            res.send(validationResult);
            return;
        }
        // continue of validationresult == OK
        var shippingId = util.guid();
        shipping.shippingId = shippingId;
        shipping.shippingStatus = "new";
        // initialize shipping auditTrail
        shipping.auditTrail = [{
            "timestamp": util.getTimestampAsString()
            , "status": "new"
            , "comment": "creation of new shipping"
        }]

        shipping.shippingCosts = calculateShippingCosts(shipping)
        shipping.submissionDate = util.getTimestampAsString();
        // get geo coordinates for destination
        try {
            var response = await geocoder.search({ "country": shipping.destination.country, "city": shipping.destination.city })
            console.log(response)
            shipping.destination.coordinates = {
                "lat": response[0].lat,
                "lon": response[0].lon
            }

        }
        catch (error) {
            console.log(error)
        }
        model.saveShipping(shipping).then((result) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(shipping);
            eventBusPublisher.publishShippingEvent(shipping)
        })
    });

    app.post('/shipping/validate', function (req, res) {
        var shipping = req.body;
        validateShipping(shipping).then((validation) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(validation);
        }
        )
    });
// http://www.nationsonline.org/oneworld/country_code_list.htm
    var supportedDestinations = ['nl','us','uk','de','po', 'pr','ni','ma','sg','ch','in'] 

    var validateShipping = async function (shipping) {
        var validation = {
            "status": "OK"
            , "validationFindings": []
        };
        var productIdentifiers = shipping.items.reduce(function (ids, item) {
            ids.push(item.productIdentifier)
            return ids
        }
            , [])
        var stocks = await model.retrieveProductStock(productIdentifiers)
        console.log(JSON.stringify(stocks))
        shipping.items.forEach(function (item) {
            if (!stocks[item.productIdentifier] || stocks[item.productIdentifier] < item.itemCount) {
                validation.status = "NOK";
                validation.validationFindings.push({
                    "findingType": "outOfStockItem",
                    "offendingItem": item
                })
            }
        })

        if (!supportedDestinations.includes( shipping.destination.country)) {
            validation.status = "NOK";
            validation.validationFindings.push({
                "findingType": "invalidDestination"
            })
        }
        validation.shippingCosts = calculateShippingCosts(shipping)

        return validation;
    }

    function calculateShippingCosts(shipping) {
        var costs = 1.5;
        shipping.items.forEach(function (item) {
            costs = costs + (0.3 * item.itemCount)
        })
        if ('premium' == shipping.shippingMethod) {
            costs = costs * 1.34
        }
        return costs;
    }

}
