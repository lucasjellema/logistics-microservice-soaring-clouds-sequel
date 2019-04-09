//const fdk=require('@fnproject/fdk');
const logger = require('./logger'); //our logger module

////////////////////////
// Generate Shippings
////////////////////////

const rp = require("request-promise-native");

async function processData() {
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
        return response
    } catch (error) {
        console.log("Error: ", error);
    }
}

async function getProducts() {
    var p = await processData()
  //  console.log("Handle Prods has products")
    //logger.log('info', `Prods: ${JSON.stringify(p)}`)
    return p;
}




async function doIt() {
    logger.log('info', `runShippingGenerationJob - retrieve all products from model`)
    var products = await getProducts();
    logger.log('info', `runShippingGenerationJob - products received  `)
    logger.log('info', `runShippingGenerationJob - products : ${products}  `)
    return;
}

//fdk.handle(function(input){
let name = 'World';
//  logger.log('info',`Report from function Shipping Generator, invoked with input ${JSON.stringify(input)}`)
//     if (input.name) {
//     name = input.name;
//   }
doIt()
//    return {'message': 'Final Report from Shippings Generator Function ' + name}
// })

