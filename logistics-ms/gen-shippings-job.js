const fdk = require('@fnproject/fdk');
const logger = require('./logger'); //our logger module
const rp = require("request-promise-native");


var APP_VERSION = "0.0.16"
var APP_NAME = "Shippings Generation Background Jobs"


////////////////////////
// Generate Shippings
////////////////////////
async function postShipping(shipping) {
    logger.log('info', `go post shipping for ${JSON.stringify(shipping)}`)
    var options = {
        method: 'POST',
        uri: 'http://129.213.11.15/soaring/logistics/shipping',
        body: shipping,
        headers:
        {
            'cache-control': 'no-cache'
        }, json: true // Automatically parses the JSON string in the response};
    }
    try {
        let response = await rp(options);
        logger.log('info', `response from postShipping ${JSON.stringify(response)}`)
        return response
    } catch (error) {
        console.log("Error: ", error);
        logger.log('error', `error in post shipping ${JSON.stringify(error)}`)
    }
}//postShipping

async function processShipping(shipping) {
    logger.log('info', `processShipping for ${JSON.stringify(shipping)}`)
    await postShipping(shipping)
    logger.log('info', `Shipping is saved ${JSON.stringify(shipping)}`)

    // logisticsModel.saveShipping(shipping).then((result) => {
    //     logger.log('info',`publishing Event after saving ${JSON.stringify(shipping)}`)

    //     eventBusPublisher.publishShippingEvent(shipping)
    //     return
    // })
    return
}//processShipping



async function getProducts() {
    var options = {
        method: 'GET',
        uri: 'http://129.213.11.15/soaring/logistics/products',
        headers:
        {
            'cache-control': 'no-cache'
        }, json: true // Automatically parses the JSON string in the response};
    }
    try {
        let response = await rp(options);
        logger.log('info', `Products have been retrieved `)
        return response
    } catch (error) {
        logger.log('error', `error in get products ${JSON.stringify(error)}`)
    }
}//getProducts

var firstNames = ['John', 'George', 'Mia', 'Maria', 'Wanda', 'Rose', 'Mary', 'Jacky', 'Melinda', 'Carl', 'Jan', 'Jos', 'Alonso', 'Luis', 'Franz', 'Robert', 'Priscilla', 'Jane', 'Sophie', 'Marguerita', 'Harvey', 'Guido']
var lastNames = ['Brown', 'Bohmer', 'Jansen', 'Velasquez', 'Rosario', 'Miller', 'Perot', 'Strauss', 'Gates', 'Tromp', 'Bizet', 'Wagner', 'Dorel', 'Flores', 'Doe', 'Raven', 'Koothripalli', 'Downes', 'Potter']
var destinations = [{ "country": "de", "city": "Frankfurt" }, { "country": "nl", "city": "Zoetermeer" }, { "country": "gb", "city": "Manchester" }, { "country": "nl", "city": "Groningen" }
    , { "country": "ch", "city": "Bern" }, { "country": "pt", "city": "Lisbon" }
    , { "country": "ch", "city": "Geneva" }, { "country": "gb", "city": "London" }
    , { "country": "de", "city": "Dortmund" }, { "country": "pt", "city": "Porto" }
    , { "country": "de", "city": "Hamburg" }, { "country": "in", "city": "Hyderabad" }
    , { "country": "us", "city": "San Francisco" }, { "country": "in", "city": "Mumbai" }
    , { "country": "us", "city": "Austin" }, { "country": "us", "city": "Seattle" }
    , { "country": "us", "city": "Chicago" }, { "country": "us", "city": "Savannah" }
    , { "country": "us", "city": "New York" }, { "country": "ch", "city": "Montreux" }
    , { "country": "nl", "city": "Amsterdam" }, { "country": "gb", "city": "Bristol" }
    , { "country": "za", "city": "Cape Town" }, { "country": "it", "city": "Pisa" }
    , { "country": "ar", "city": "Buenos Aires" }, { "country": "it", "city": "Napoli" }
    , { "country": "ar", "city": "Mar del Plata" }, { "country": "it", "city": "Vicenza" }
    , { "country": "us", "city": "Tucson" }, { "country": "au", "city": "Sydney" }
    , { "country": "au", "city": "Perth" }, { "country": "au", "city": "Melbourne" }
    , { "country": "ar", "city": "Cordoba" }, { "country": "us", "city": "Portland" }

]

runShippingGenerationJob = async function () {
    logger.log('info', "Run shipping generation job at " + new Date())
    logger.log('info', `runShippingGenerationJob - retrieve all products from model`)

    var products = await getProducts();
    logger.log('info', `runShippingGenerationJob - ${products.length} products received  `)
    //logger.log('debug',`Products ${JSON.stringify(products)}`)

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
                "productIdentifier": products[Math.floor(Math.random() * (products.length - 3))].id,
                "itemCount": Math.floor(Math.random() * 8)
            }
        ]
    }

    if (Math.random() < 0.8) {
        shipping.items.push(
            {
                "productIdentifier": products[Math.floor(Math.random() * products.length)].id,
                "itemCount": Math.floor(Math.random() * 11)
            })
    }

    if (Math.random() < 0.3) {
        shipping.items.push({
            "productIdentifier": products[Math.floor(Math.random() * products.length)].id,
            "itemCount": Math.floor(Math.random() * 3)
        }
        )
    }

    logger.log('info', `runShippingGenerationJob - prepared shipping  ${JSON.stringify(shipping)}`)

    await processShipping(shipping)
    return shipping

}//runShippingGenerationJob


fdk.handle(async function (input) {
    let name = 'World';
    logger.log('info', `Report from version ${APP_VERSION} function Shipping Generator, invoked with input ${JSON.stringify(input)}`)
    if (input.name) {
        name = input.name;
    }
    var result = {}
    // only generate a shipping in 60% of cases
    if (Math.random() < 0.6)
        result = await runShippingGenerationJob()
    else
        logger.log('info', `The randomizer has decided to skip this generation - no shipping is created`)


    return { 'message': `Final Report from ${APP_NAME} Function (version ${APP_VERSION} ${name}`, "result": result }
})

// runShippingGenerationJob()
