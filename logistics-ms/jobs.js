
var logisticsModel = require("./model/model");
var util = require("./util");

var eventBusPublisher = require("./EventPublisher.js");
const avroEventBusPublisher = require("./AvroEventPublisher.js");
avroEventBusPublisher.initKafkaAvro()
const Nominatim = require('nominatim-geocoder')
const geocoder = new Nominatim({}, {
    format: 'json',
    limit: 3
})

var APP_VERSION = "0.0.17"
var APP_NAME = "Logistics Background Jobs"

var jobs = module.exports;


console.log("Running Module " + APP_NAME + " version " + APP_VERSION);

var baseExecutionRatio = 0.6;

// this job locates all running (open) shippings
// it will process a certain percentage of all shippings (for example 70%)
//  
jobs.runShippingJob = function () {
    scheduleJob();
    console.log("Run shipping execution job at " + new Date())
    logisticsModel.retrieveOpenShippings().then((result) => {
        var openShippings = result.hits.hits;
        console.log("Non Closed Shippings " + openShippings.length);
        // "new",
        // "picking",
        // "handedOverToParcelDelivery",
        // end states: "delivered","lost", "canceled"
        openShippings.forEach(function (hit) {
            var shipping = hit._source
            shipping.doc_id = hit._id
            executionRatio = baseExecutionRatio

            // decrease executionRatio depending on
            // - item count (odd * 0.5, 13 * 0.1)
            var totalItemCount = shipping.items.reduce(function sum(total, item) { return total + item.itemCount }, 0)
            if (Math.abs(totalItemCount % 2) == 1) executionRatio = executionRatio * 0.5
            if (totalItemCount == 13) executionRatio = executionRatio * 0.1
            // - destination (country nl *1.5, us * 0.2)
            executionRatio = executionRatio * (['nl', 'au'].includes(shipping.destination.country) ? 1.5 : (['ch', 'us'].includes(shipping.destination.country) ? 0.2 : 1))

            // in executionRatio
            if (Math.random() < executionRatio) {
                if (["lost", "new"].includes(shipping.shippingStatus) || !shipping.shippingStatus) {
                    try {
                        pickForShipping(shipping)
                    } catch (e) { console.error("error in pick ing " + JSON.stringify(e)) }
                }
                if ("picked" == shipping.shippingStatus) {
                    try {
                        if (shipping.shippingMethod == 'MARKETPLACE') {
                            handOverToExternalShipper(shipping)
                        } else {
                            handOverShipping(shipping)
                        }
                    } catch (e) { console.error("error in handover to parcel service " + JSON.stringify(e)) }
                }
                if (["handedOverToParcelDelivery", "enRoute", "inDepot"].includes(shipping.shippingStatus)) {
                    try {
                        handleByParcelDeliveryService(shipping)
                    } catch (e) { console.error("error in handling by  parcel service " + JSON.stringify(e)) }
                }
            }

        })

    }).catch(function (e) {
        console.error("problem finding open shippings " + JSON.stringify(e));
    })
}//runShippingJob

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

async function pickForShipping(shipping) {

    console.log("Pick for shipping " + shipping.shippingId)
    // do stuff, then update shipping
    //    var result = await logisticsModel.retrieveProductStock(["42371XX", "XCZ", "XCSSSSZ"])
    //TODO deal with case where stock is not enough to pick!
    shipping.items.forEach(function (item) {
        logisticsModel.saveProductStockTransaction(
            {
                "productIdentifier": item.productIdentifier
                , "quantityChange": -1 * item.itemCount
                , "category": "pick"
                , "timestamp": util.getTimestampAsString()
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

}//pickForShipping

function handOverToExternalShipper(shipping) {
    console.log(`Make available external shipper ${shipping.shipping.shippingCompany} ${shipping.shippingId}`)
    // - set new status
    shipping.shippingStatus = "madeAvailableToExternalShipper";
    // - extend audit
    console.log(`Update audit trail and shipping document`)
    addToAuditTrail(shipping, `parcel(s) made available to external shipper ${shipping.shipping.shippingCompany}`)
    // save shipping document
    logisticsModel.updateShipping(shipping)
    // publish event to soaring-orderpicked
    console.log('Going to publish Shipping Picked event')
    var timestamp = Math.round((new Date()).getTime() / 1000)
    var event = { "orderId": shipping.orderIdentifier, "date":  timestamp  }
    console.log(`Going to publish Shipping Picked event ${JSON.stringify(event)}`)
    // TODO fix the value for date; for some reason it is too big
    //event.date=42
    avroEventBusPublisher.publishShipmentPicked(event)
    console.log('Shipping Picked was published')
}// handOverToExternalShipper


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

}//handOverShipping

var depotToRoutingRatio = 0.8;
var enRouteToNextRatio = 0.6;

var warehouseLocations = ['Singapore,sg', 'Amsterdam,nl', 'Frankfurt,de', 'New York,us', 'Buenos Aires,ar', 'Cape Town,za', 'Perth,au']

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
                console.log('Parcel is now on its way');
                var parcelLogItem = {
                    "location": "",
                    "parcelStatus": "enRoute",
                    "parcelLogTimestamp": util.getTimestampAsString(),
                    "estimatedDeliveryDate": util.getDateAsString(new Date().addDays(2)),
                }
                shipping.parcels[0].parcelLogItems.push(parcelLogItem);
                shipping.parcels[0].estimatedDeliveryDate = parcelLogItem.estimatedDeliveryDate;
                shipping.shippingStatus = "enRoute";
                shippingUpdated = true
            } // if < depotToRoutingRatio
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
                            "parcelLogTimestamp": util.getTimestampAsString(),
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
                            "location": warehouseLocations[Math.floor(Math.random() * warehouseLocations.length)],
                            "parcelStatus": "inDepot",
                            "parcelLogTimestamp": util.getTimestampAsString(),
                            "estimatedDeliveryDate": util.getDateAsString(new Date().addDays(4)),
                        }
                        shipping.parcels[0].parcelLogItems.push(parcelLogItem);
                        shipping.parcels[0].estimatedDeliveryDate = parcelLogItem.estimatedDeliveryDate;
                        shipping.shippingStatus = "inDepot";
                        shippingUpdated = true
                        break;
                    case dice < 0.95:
                        console.log('deliver');
                        var parcelLogItem = {
                            "location": "customer",
                            "parcelLogTimestamp": util.getTimestampAsString(),
                            "parcelStatus": "delivered"
                        }
                        shipping.parcels[0].parcelLogItems.push(parcelLogItem);
                        shipping.shippingStatus = "delivered";
                        shipping.parcels[0].estimatedDeliveryDate = util.getDateAsString();
                        shippingUpdated = true;
                        break;
                    default:
                        console.log('deliver');
                        var parcelLogItem = {
                            "location": "customer",
                            "parcelLogTimestamp": util.getTimestampAsString(),
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
            console.log('no action required (says the die), parcel status remains at  ' + currentLogItem.parcelStatus + '.');
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
var x = 127.0;
var y = 17.0;
function scheduleJob() {
    var delay = x * 1000 + (y * (0.5 - Math.random()) * 1000);
    setTimeout(jobs.runShippingJob, delay);
}// scheduleJob

jobs.runShippingJob();



jobs.runWarehouseJob = async function () {
    // first of all, schedule the next execution of the job - in case this execution fails 
    scheduleWarehouseJob();
    console.log("Run warehouse job at " + new Date())
    // loop over all products in the warehouse; 
    // if product stock < 5, then replenish in X% of the cases with 10 + random * 200 items
    // if product stock >= 5, then replenish in Y% of the cases with 10 + random * 100 items
    // if product stock >= 150, then replenish in Z% of the cases with 10 + random * 30 items

    var productStock = await logisticsModel.retrieveProductStock()
    console.log("Current Product Stock " + JSON.stringify(productStock))
    for (var product in productStock) {
        console.log("product" + product + " stock = " + productStock[product])
        var dice = Math.random();
        if (productStock[product] < 5) {
            console.log("Low stock, seriously consider to replesh")
            console.log("Die was cast as " + dice)
            if (dice < 0.3) {
                console.log("Replenish should happen now ")
                var quantity = 10 + Math.floor(Math.random() * 10)
                console.log("Replenish quantity set to " + quantity)
                var result = await logisticsModel.saveProductStockTransaction(
                    {
                        "productIdentifier": product
                        , "quantityChange": quantity
                        , "category": "replenish"
                        , "timestamp": util.getTimestampAsString()
                    })
                console.log("Result of Replenish  " + JSON.stringify(result))

            }
        }
        else { // stock > 5
            console.log("Safe stock quantity, replenish sparingly (5% chance)")
            console.log("Die was cast as " + dice)
            if (dice < 0.05) {
                var quantity = 5 + Math.floor(Math.random() * 20)
                console.log("Replenish quantity set to " + quantity)
                var result = await logisticsModel.saveProductStockTransaction(
                    {
                        "productIdentifier": product
                        , "quantityChange": quantity
                        , "category": "replenish"
                        , "timestamp": util.getTimestampAsString()
                    })
                console.log("Result of Replenish  " + JSON.stringify(result))
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
}//runWarehouseJob


// schedule a job to run every warehouseJobPeriod seconds with a variation of warehouseJobFluctuation
// the warehouse job will replenish stock - with a certain chance
var warehouseJobPeriod = 500.0; //seconds
var warehouseJobFluctuation = 60.0;

function scheduleWarehouseJob() {
    console.log("Run ScheduleWarehouseJob " + new Date())
    var delay = warehouseJobPeriod * 1000 + (warehouseJobFluctuation * (0.5 - Math.random()) * 1000);
    setTimeout(jobs.runWarehouseJob, delay);
}//scheduleWarehouseJob


jobs.runWarehouseJob();

////////////////////////
// Generate Shippings
////////////////////////

function calculateShippingCosts(shipping) {
    var costs = 1.5;
    shipping.items.forEach(function (item) {
        costs = costs + (0.3 * item.itemCount)
    })
    if ('premium' == shipping.shippingMethod) {
        costs = costs * 1.34
    }
    return costs;
}//calculateShippingCosts
// http://www.nationsonline.org/oneworld/country_code_list.htm
var supportedDestinations = ['nl', 'us', 'uk', 'gb', 'de', 'po', 'pr', 'ni', 'ma', 'au', 'sg', 'ch', 'in', 'pt', 'za', 'it', 'ar']

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
    var stocks = await logisticsModel.retrieveProductStock(productIdentifiers)
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
}//validateShipping



async function processShipping(shipping) {
    var validationResult = await validateShipping(shipping)
    if (validationResult.status == "NOK") {
        console.log('Generated Shipping is not valid and will be discarded')
        console.log(JSON.stringify(validationResult))
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
    logisticsModel.saveShipping(shipping).then((result) => {
        eventBusPublisher.publishShippingEvent(shipping)
    })

}//processShipping

var firstNames = ['John', 'George', 'Mia', 'Maria', 'Wanda', 'Rose', 'Mary', 'Jacky', 'Melinda', 'Carl', 'Lonneke', 'Luis', 'Sven', 'Jose', 'Willem', 'Sandrijn', 'Jan', 'José', 'Alonso', 'Luis']
var lastNames = ['Brown', 'Böhmer', 'Jansen', 'Velasquez', 'Rosario', 'Miller', 'Perot', 'Strauss', 'Gates', 'Tromp', 'Bizet', 'Wagner', 'Dorel', 'Kress', 'Vlek', 'Kemp']
var destinations = [{ "country": "de", "city": "Frankfurt" }, { "country": "nl", "city": "Zoetermeer" }, { "country": "gb", "city": "Manchester" }, { "country": "nl", "city": "Groningen" }
    , { "country": "ch", "city": "Bern" }, { "country": "pt", "city": "Lisbon" }
    , { "country": "ch", "city": "Geneva" }, { "country": "gb", "city": "London" }
    , { "country": "de", "city": "Dortmund" }, { "country": "pt", "city": "Porto" }
    , { "country": "de", "city": "München" }, { "country": "in", "city": "Hyderabad" }
    , { "country": "us", "city": "San Francisco" }, { "country": "in", "city": "Mumbai" }
    , { "country": "us", "city": "Austin" }, { "country": "us", "city": "Seattle" }
    , { "country": "us", "city": "Chicago" }, { "country": "us", "city": "Savannah" }
    , { "country": "us", "city": "New York" }, { "country": "ch", "city": "Montreux" }
    , { "country": "nl", "city": "Amsterdam" }, { "country": "gb", "city": "Bristol" }
    , { "country": "za", "city": "Cape Town" }, { "country": "it", "city": "Pisa" }
    , { "country": "za", "city": "Pretoria" }, { "country": "it", "city": "Messina" }
    , { "country": "za", "city": "Durban" }, { "country": "it", "city": "Bergamo" }
    , { "country": "ar", "city": "Buenos Aires" }, { "country": "it", "city": "Napoli" }
]

jobs.runShippingGenerationJob = async function () {
    console.log("Run shipping generation job at " + new Date())
    scheduleShippingGenerationJob()
    var products = await logisticsModel.retrieveProducts();
    // select two products at random
    // derive random orderIdentifier
    // define destination from list of options
    // "destination": { "country": destinations[Math.floor(Math.random() * destinations.length)]
    // define nameAddressee from list of options
    // 
    // randomly derive itemCount
    var shipping =
    {
        "orderIdentifier": "ORD" + String(Math.floor(Math.random() * 10919111)),
        "nameAddressee": firstNames[Math.floor(Math.random() * firstNames.length)] + " " + lastNames[Math.floor(Math.random() * lastNames.length)],
        "destination": destinations[Math.floor(Math.random() * destinations.length)],
        "shippingMethod": "economy",
        "giftWrapping": false,
        "personalMessage": "",
        "items": [

            {
                "productIdentifier": products.hits.hits[Math.floor(Math.random() * products.hits.hits.length)]._source.id,
                "itemCount": Math.floor(Math.random() * 8)
            },
            {
                "productIdentifier": products.hits.hits[Math.floor(Math.random() * products.hits.hits.length)]._source.id,
                "itemCount": Math.floor(Math.random() * 11)
            }
        ]
    }
    processShipping(shipping)


}//runShippingGenerationJob

var shippingGenerationJobPeriod = 500.0; //seconds
var shippingGenerationJobFluctuation = 370.0;
function scheduleShippingGenerationJob() {
    var delay = shippingGenerationJobPeriod * 1000 + (shippingGenerationJobFluctuation * (0.5 - Math.random()) * 1000);
    setTimeout(jobs.runShippingGenerationJob, delay);
}//scheduleShippingGenerationJob

// TODO this is now down from a standalone Function
// jobs.runShippingGenerationJob()

