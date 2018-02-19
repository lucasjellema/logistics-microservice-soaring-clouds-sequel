
var logisticsModel = require("./model/model");
var util = require("./util");
var eventBusPublisher = require("./EventPublisher.js");

var APP_VERSION = "0.0.2"
var APP_NAME = "Logistics Background Jobs"

var jobs = module.exports;


console.log("Running Module " + APP_NAME + " version " + APP_VERSION);

var executionRatio = 0.6;

jobs.runShippingJob = function () {
    console.log("Run shipping job" + new Date())
    logisticsModel.retrieveOpenShippings().then((result) => {
        var openShippings = result.hits.hits;
        console.log("Non Closed Shippings " + openShippings.length);
        // "new",
        // "picking",
        // "handedOverToParcelDelivery",
        // end states: "delivered","lost", "canceled"
        openShippings.forEach(function (hit) {
            // in executionRatio
            if (Math.random() < executionRatio) {
                if ("new" == hit._source.shippingStatus) {
                    try {
                        pickForShipping(hit._source)
                    } catch (e) { console.error("error in pick ing " + JSON.stringify(e)) }
                }
                if ("picked" == hit._source.shippingStatus) {
                    try {
                        handOverShipping(hit._source)
                    } catch (e) { console.error("error in handover to parcel service " + JSON.stringify(e)) }
                }
                if ("handedOverToParcelDelivery" == hit._source.shippingStatus) {
                    try {
                        handleByParcelDeliveryService(hit._source)
                    } catch (e) { console.error("error in handling by  parcel service " + JSON.stringify(e)) }
                }
            }

        })

    }).catch(function (e) {
        console.error("problem finding open shippings " + JSON.stringify(e));
    })
    scheduleJob();
}

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

}

async function pickForShipping(shipping) {
    console.log("Pick for shipping " + shipping.shippingId)
    // do stuff, then update shipping
    var result = await logisticsModel.retrieveProductStock(["42371XX", "XCZ", "XCSSSSZ"])

    shipping.items.forEach(function (item) {
        logisticsModel.saveProductStockTransaction(
            {
                "productIdentifier": item.productIdentifier
                , "quantityChange": -1 * item.itemCount
                , "category": "pick"
                , "timestamp": util.getTimestampAsString
            }
        )
    })


    // - set new status
    shipping.shippingStatus = "picked";
    // - extend audit
    addToAuditTrail(shipping, "order items picked for shipping")
    // save shipping document
    // TODO send partial document instead of entire shipping
    logisticsModel.updateShipping(shipping)
    // publish shipping news event
    eventBusPublisher.publishShippingEvent(shipping)

}


function handOverShipping(shipping) {
    console.log("Hand over shipping " + shipping.shippingId)
    // do stuff, then update shipping
    // - define parcels - for now just one
    // - generate fake track & trace number
    var parcel = {
        "parcelDeliveryService": "XYZ",
        "trackAndTraceIdentifier": "TX-" + "XYZ" + shipping.shippingId + "1",
        "estimatedDeliveryDate": shipping.desiredDeliveryDate ? shipping.desiredDeliveryDate : util.getDateAsString(new Date().addDays(5)),
        "parcelLogItems": [{
            "location": "Frankfurt, de",
            "parcelStatus": "inDepot"

            //      , "estimatedDeliveryDate": ""
        }
        ]
    }
    shipping.parcels = [parcel];
    // - set new status
    shipping.shippingStatus = "handedOverToParcelDelivery";
    // - extend audit
    addToAuditTrail(shipping, "parcel(s) handed over to parcel delivery service")
    // save shipping document
    // TODO send partial document instead of entire shipping
    logisticsModel.updateShipping(shipping)
    // publish shipping news event
    eventBusPublisher.publishShippingEvent(shipping)

}

var depotToRoutingRatio = 0.8;
var enRouteToNextRatio = 0.6;
function handleByParcelDeliveryService(shipping) {
    console.log("Handle by Parcel Delivery Service " + shipping.shippingId)
    // do stuff, create new parcelLogItem then update shipping with it; also update parcel level estimatedDeliveryDate
    // get current status of parcel
    var currentLogItem = shipping.parcels[0].parcelLogItems.slice(-1)[0];
    var shippingUpdated = false;
    var today = new Date();
    switch (currentLogItem.parcelStatus) {
        case 'inDepot':
            console.log('Parcel is in depot, start to move it (in most cases)');
            if (Math.random() < depotToRoutingRatio) {
                var parcelLogItem = {
                    "location": "",
                    "parcelStatus": "enRoute",
                    "estimatedDeliveryDate": util.getDateAsString(new Date().addDays(2)),
                }
                shipping.parcels[0].parcelLogItems.push(parcelLogItem);
                shipping.parcels[0].estimatedDeliveryDate = parcelLogItem.estimatedDeliveryDate;
                shippingUpdated = true
            } // if < depotToRoutingRatio
            shippingUpdated = true;
            break;
        case 'enRoute':
            console.log('Parcel is en route, start to either deliver it, move it into a another depot, lose it');
            if (Math.random() < enRouteToNextRatio) {
                var dice = Math.random();
                switch (true) {
                    case dice < 0.05:
                        console.log('Lose Parcel');
                        var parcelLogItem = {
                            "location": "unknown",
                            "parcelStatus": "lost"
                        }
                        shipping.parcels[0].parcelLogItems.push(parcelLogItem);
                        shipping.shippingStatus = "lost";
                        shipping.parcels[0].estimatedDeliveryDate = '';
                        shippingUpdated = true
                        break;
                    case dice < 0.35:
                        console.log('Ship to another depot');
                        var parcelLogItem = {
                            "location": "Singapore,sg",
                            "parcelStatus": "inDepot",
                            "estimatedDeliveryDate": util.getDateAsString(new Date().addDays(4)),
                        }
                        shipping.parcels[0].parcelLogItems.push(parcelLogItem);
                        shipping.parcels[0].estimatedDeliveryDate = parcelLogItem.estimatedDeliveryDate;
                        shippingUpdated = true
                        break;
                    default:
                        console.log('deliver');
                        var parcelLogItem = {
                            "location": "customer",
                            "parcelStatus": "delivered"
                        }
                        shipping.parcels[0].parcelLogItems.push(parcelLogItem);
                        shipping.shippingStatus = "delivered";
                        shipping.parcels[0].estimatedDeliveryDate = util.getDateAsString();
                        shippingUpdated = true
                }
            }// if < enRouteToNextRatio
            break;
        default:
            console.log('no action required, parcel status =  ' + currentLogItem.parcelStatus + '.');
    }

    // - set new status, if parcel is delivered or lost
    // shipping.shippingStatus = "handedOverToParcelDelivery";
    if (shippingUpdated) {
        // - extend audit
        addToAuditTrail(shipping, "update from parcel delivery service")
        // save shipping document
        // TODO send partial document instead of entire shipping
        logisticsModel.updateShipping(shipping)
        // publish shipping news event
        eventBusPublisher.publishShippingEvent(shipping)
    }
}//handleByParcelDeliveryService

// schedule a job to run every X seconds with a variation of y
var x = 126.0;
var y = 17.0;
function scheduleJob() {
    var delay = x * 1000 + (y * (0.5 - Math.random()) * 1000);
    setTimeout(jobs.runShippingJob
        , delay);
}


scheduleJob();



jobs.runWarehouseJob = async function () {
    console.log("Run warehouse job" + new Date())
    // loop over all products in the warehouse; 
    // if product stock < 5, then replenish in X% of the cases with 10 + random * 200 items
    // if product stock >= 5, then replenish in Y% of the cases with 10 + random * 100 items
    var productStock = await logisticsModel.retrieveProductStock()
    console.log(JSON.stringify(productStock))
    for (var product in productStock) {
        console.log("product" + product + " stock = " + productStock[product])
        if (productStock[product] < 5) {
            if (Math.random() < 0.3) {
                var quantity = 10 + Math.floor(Math.random() * 200)
                logisticsModel.saveProductStockTransaction(
                    {
                        "productIdentifier": product
                        , "quantityChange": quantity
                        , "category": "replenish"
                        , "timestamp": util.getTimestampAsString()
                    })
            }
        }
    }//for

    // logisticsModel.saveProductStockTransaction(
    //     {
    //         "productIdentifier": item.productIdentifier
    //         , "quantityChange": -1 * item.itemCount
    //         , "category": "pick"
    //         , "timestamp": util.getTimestampAsString
    //     }
    // )
    scheduleWarehouseJob();
}


// schedule a job to run every warehouseJobPeriod seconds with a variation of warehouseJobFluctuation
var warehouseJobPeriod = 250.0;
var warehouseJobFluctuation = 20.0;
function scheduleWarehouseJob() {
    var delay = warehouseJobPeriod * 1000 + (warehouseJobFluctuation * (0.5 - Math.random()) * 1000);
    setTimeout(jobs.runWarehouseJob
        , delay);
}


scheduleWarehouseJob();