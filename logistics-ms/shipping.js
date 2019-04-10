
const Nominatim = require('nominatim-geocoder')
const geocoder = new Nominatim({}, {
    format: 'json',
    limit: 3
})

var util = require("./util");
var model = require("./model/model");
var eventBusPublisher = require("./EventPublisher.js");

var APP_VERSION = "0.0.20" 
var APP_NAME = "Shipping"

var shipping = module.exports;


console.log("Running Module " + APP_NAME + " version " + APP_VERSION);

shipping.registerAPIs = function (app) {


    app.get('/shipping/period/:period', function (req, res) {
        // dateRange = day, week, month, year
        var dateRange = req.params['period'];
        model.retrieveDateRangeShippings(dateRange).then((result) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(result.hits.hits
            );

        }).catch(function (e) {
            res.send(404);
        })
    });

    //demo
    app.get('/shipping/forProduct/:productIdentifier', async function (req, res) {
        var productIdentifier = req.params['productIdentifier'];
        var shippingsResult = await model.retrieveShippingsForProduct(productIdentifier, true)
        try {
            res.setHeader('Content-Type', 'application/json');
            console.log("shippings " + JSON.stringify(shippingsResult))
            // create an array of products - removing all Elasic Search specific properties
            var shippings =
                shippingsResult.hits.hits.reduce(function (shippings, item) {
                    var shipping = item._source
                    // walk over all shipping.items and find the items with item[].productIdentifier = productIdentifier
                    // sum quantities to shipping.quantity
                    shipping.quantity = shipping.items.reduce(function (quantity, item) {
                        if (item.productIdentifier == productIdentifier) { return quantity + item.itemCount }
                    }, 0)
                    shipping.destinationCity = shipping.destination.city
                    shipping.destinationCountry = shipping.destination.country
                    // walk over all auditTrail entries and find the most recent one; set shipping.status and shipping.lastUpdateTimestamp from that auditTrail entry
                    shipping.auditTrail.reduce(function (latestTimestamp, auditEntry) {
                        if (!latestTimestamp || Date.parse(auditEntry.timestamp) > latestTimestamp) {
                            shipping.status = auditEntry.status
                            shipping.lastUpdateTimestamp = auditEntry.timestamp
                            return Date.parse(auditEntry.timestamp)
                        } else return latestTimestamp

                    }, null)
                    shippings.push(shipping)
                    return shippings
                }, [])
            if (shippings.length == 0) {
                res.send(404);
                return;
            }
            res.send(shippings);
        } catch (e) {
            res.send(404);
        }
    });


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


    app.get('/shipping/forOrder/:orderIdentifier', function (req, res) {
        var orderIdentifier = req.params['orderIdentifier'];
        model.retrieveShippingForOrder(orderIdentifier).then((result) => {
            res.setHeader('Content-Type', 'application/json');
            console.log("Result: " + JSON.stringify(result))
            var shipping = result.hits.hits[0]._source;
            res.send(shipping);
        }).catch(function (e) {
            res.send(404);
        })
    });


//    Result: {"took":0,"timed_out":false,"_shards":{"total":5,"successful":5,"skipped":0,"failed":0}
//,"hits":{"total":1,"max_score":4.3985558
//,"hits":[{"_index":"shipping","_type":"doc","_id":"4401473f-7656-074f-48c0-5ea1c40ac7a6","_score":4.3985558
//,"_source":{"orderIdentifier":"fdnn0skxs","nameAddressee":"Marieke van Nimwegen","destination":{"city":"Nijmegen","country":"nl","coordinates":{"lat":"51.84257485","lon":"5.83896062874823"}},"shippingMethod":"MARKETPLACE","shipping":{"shippingMethod":"MARKETPLACE","shippingCompany":"Edfex","shippingId":"1"},"giftWrapping":false,"personalMessage":false
//,"items":[{"productIdentifier":"8f498e2e-21e6-11e8-b467-0ed5f89f718b","itemCount":10}],"shippingId":"4401473f-7656-074f-48c0-5ea1c40ac7a6","shippingStatus":"madeAvailableToExternalShipper"
// ,"auditTrail":[{"comment":"creation of new shipping","timestamp":"2019-4-10T8:9:27","status":"new"},{"comment":"order items picked for shipping","timestamp":"2019-4-10T8:12:53","status":"picked"},{"comment":"parcel(s) made available to external shipper Edfex","timestamp":"2019-4-10T8:12:53","status":"madeAvailableToExternalShipper"}],"shippingCosts":4.5,"submissionDate":"2019-4-10T8:9:27","doc_id":"4401473f-7656-074f-48c0-5ea1c40ac7a6"}}]}}
    app.get('/shippingUI/forOrder/:orderIdentifier', function (req, res) {
        var orderIdentifier = req.params['orderIdentifier'];
        model.retrieveShippingForOrder(orderIdentifier).then((result) => {
            res.setHeader('Content-Type', 'text/html');
            console.log("Result: " + JSON.stringify(result))
            var shipping = result.hits.hits[0]._source;
            var auditTrail = `<ol>`
            shipping.auditTrail.forEach(function (entry) {
                auditTrail = auditTrail.concat(`<li><b><i>${entry.status}</i></b> (time: ${entry.timestamp.substr(entry.timestamp.indexOf('T') + 1)})</li>`)
            })
            auditTrail = auditTrail.concat('</ol>')
            console.log(`Audit trail ${auditTrail}`)
            var parcels 
            if (shipping.parcels && shipping.parcels.length>0) {
            parcels = `Number of parcels ${shipping.parcels.length}<br/ >`
            shipping.parcels.forEach(function (parcel, index) {
                parcels = parcels.concat(`${index + 1} - Track and Trace Identifier: ${parcel.trackAndTraceIdentifier}`)
                parcels = parcels.concat('<ol>')
                parcel.parcelLogItems.forEach(function (item) {
                    parcels = parcels.concat(`<li><b><i>${item.parcelStatus}</i></b> ${item.parcelLogTimestamp ? ' (time: ' + item.parcelLogTimestamp + ')' : ''} - ${item.location}</li>`)
                })
                parcels = parcels.concat('</ol>')
            })
            }
            console.log(`Parcels parcels${parcels}`)
            var html = `<html>
            <head>
              <title>Soaring - Shipping Details for Order</title>
              <script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.2/jquery.min.js"></script>
              <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.1/css/bootstrap.min.css">
              <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.1/css/bootstrap-theme.min.css">
              <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.1/js/bootstrap.min.js"></script>
            </head>
            <body>
                <div class="jumbotron"  style="padding:40px;">
                  <h1>Shipping Details for order ${orderIdentifier}</h1>
                </div>
                <div>
                <h3>Current Status: ${shipping.shippingStatus}</h3>
                <h3>Destination: ${shipping.destination.city}, ${shipping.destination.country}</h3>
                <h3>Submission Date (order received by Logistics): ${shipping.submissionDate}</h3>
                <h3>Shipping Audit Trail:</h3>
                ${auditTrail}
                <br />
                <h3>Parcel Details:</h3>
                ${parcels}
              </div>
            </body>
            </html>`

            res.send(html);
        }).catch(function (e) {
            console.log(`failed to return HTML from /shippingUI/forOrder/ because of ${JSON.stringify(e)}`)
            res.send(404);
        })
    });

    app.post('/shipping/updateShippingStatusForOrder/:orderIdentifier', async function (req, res) {
        var orderIdentifier = req.params['orderIdentifier'];
        console.log(`Logistics MS - Update of Shipping Status for Order : ${orderIdentifier}`)
        var shippingUpdate = req.body;
        //  {"type": "","orderId":"112","shipper":"EdFex","pickupDate":1554797232}
        //TODO:
        // FIND shipping for order
        // shipmentDelivered and shipmentPickedUp
        // Update shipping with Status and Audit trail entry
        try {
            model.retrieveShippingForOrder(orderIdentifier).then((result) => {
                console.log(`returned from retrieve shipping with ${JSON.stringify(result)}`)
                if (result.hits.total == 0) // not found the shipping record
                {
                    res.send(404);

                } else {
                    res.send(202);
                    var shipping = result.hits.hits[0]
                    shipping.shippingStatus = shippingUpdate.type == "shipmentPickedUp" ? "collected picked order for delivery" : "delivered";
                    // - extend audit
                    addToAuditTrail(shipping, `update received from external shipper ${shippingUpdate.shipper}`)
                    // save shipping document
                    // TODO send partial document instead of entire shipping
                    console.log(`Logistics MS - go update shipping document to : ${JSON.stringify(shipping)}`)
                    model.updateShipping(shipping)
                }
            })// retrieveShipping    
        } catch (e) {
            console.log(`Failed to handle Shipping Update for Order : ${orderIdentifier} because of ${JSON.stringify(e)}`)

            var status = { "error": JSON.stringify(e) };
            res.setHeader('Content-Type', 'application/json');
            res.status(400);
            res.send(status);

        }
    });//updateShippingStatusForOrder


    app.post('/shipping/:shippingId/cancel', async function (req, res) {
        var shippingId = req.params['shippingId'];
        var cancelResult = await model.cancelShipping(shippingId);
        if (cancelResult && cancelResult.result == 'updated') {
            res.send(202);
            // publish shipping news: shipping canceled
            var shippingSrc = await model.retrieveShipping(shippingId);
            var shipping = shippingSrc._source
            shipping.auditTrail.push({
                "timestamp": util.getTimestampAsString()
                , "status": shipping.shippingStatus
                , "comment": "Shipping canceled"
            })
            eventBusPublisher.publishShippingEvent(shipping)
            // TODO: update audit trail in stored shipping document too
            console.log("Shipping Cancelled: " + shippingId)
        } else {
            var status = { "cancellationStatus": "shippingCannotBeCancelled" };
            res.setHeader('Content-Type', 'application/json');
            res.status(400);
            res.send(status);
        }
    });

    function addToAuditTrail(shipping, comment) {
        // initialize shipping auditTrail
        if (!shipping.auditTrail) {
            shipping.auditTrail = []
        }
        shipping.auditTrail.push({
            "timestamp": util.getTimestampAsString()
            , "status": shipping.shippingStatus
            , "comment": comment
        })

    }//addToAuditTrail



    app.delete('/shipping/:shippingId', function (req, res) {
        var shippingId = req.params['shippingId'];
        if (Math.floor(Math.random() + 0.5) == 1) {
            res.send(404);
        } else { res.send(204); }
    });


    app.post('/shipping', async function (req, res) {
        var shipping = req.body;
        var validationResult = await validateShipping(shipping)
        if (validationResult.status == "NOK") {
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

    var cors = require('cors');

    app.options('/shipping/validate', cors()) // enable pre-flight request for DELETE request
    app.post('/shipping/validate', function (req, res) {
        var shipping = req.body;
        validateShipping(shipping).then((validation) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(validation);
        }
        )
    });
    // http://www.nationsonline.org/oneworld/country_code_list.htm
    var supportedDestinations = ['nl', 'us', 'uk', 'gb', 'de', 'po', 'pr', 'ni', 'ma', 'sg', 'ch', 'in', 'pt', 'ar', 'za', 'au']

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

        if (!supportedDestinations.includes(shipping.destination.country.toLowerCase())) {
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
