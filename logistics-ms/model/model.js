var logisticsModel = module.exports;
var elasticsearch = require('elasticsearch');
const logger = require('../logger'); //our logger module

var ELASTIC_SEARCH_HOST = process.env.ELASTIC_CONNECTOR || 'http://129.213.11.15/soaring/elastic';

var client = new elasticsearch.Client({
    host: ELASTIC_SEARCH_HOST,
});

const SHIPPING_INDEX = 'shipping'
const WAREHOUSE_INDEX = 'warehouse'
const PRODUCTS_INDEX = 'products'


client.ping({
    requestTimeout: 30000,
}, function (error) {
    if (error) {
        logger.log('error', `elasticsearch cluster is down! with error ${JSON.stringify(error)}`);
    } else {
        logger.log('info', 'Connection to Elastic Search is established');
    }
});

logisticsModel.saveShipping = async function (shipping) {
    try {
        var response = await client.index({
            index: SHIPPING_INDEX,
            id: shipping.shippingId,
            type: 'doc',
            body: shipping
        }
        );

        logger.log('info', "Response: " + JSON.stringify(response));
        return shipping;
    }
    catch (e) {
        logger.log('error', "Error in Elastic Search - index document " + shipping.shippingId + ":" + JSON.stringify(e))
    }

}

logisticsModel.updateShipping = async function (shipping) {
    try {
        var response = await client.update({
            retryOnConflict: 3,
            index: SHIPPING_INDEX,
            id: shipping.doc_id,
            type: 'doc',
            body: { "doc": shipping }
        }
        );

        logger.log('info', "Response: " + JSON.stringify(response));
        return shipping;
    }
    catch (e) {
        logger.log('error', "Error in Elastic Search - update document " + shipping.shippingId + ":" + JSON.stringify(e))
    }

}


logisticsModel.retrieveShipping = async function (shippingId) {
    try {
        var shipping = await client.get({
            index: SHIPPING_INDEX,
            id: shippingId,
            type: 'doc'
        }
        );
        return shipping;
    }
    catch (e) {
        logger.log('error', "Error in Elastic Search - get document " + shippingId + ":" + JSON.stringify(e))
        throw e;
    }
}


logisticsModel.retrieveDateRangeShippings = async function (range) {
    // week: this week's shippings:  now-1w/w
    // today: today's shippings:  now-1d/d
    // month: this month's shippings:  now-1M/M
    // year: this year's shippings:  now-1y/y
    const ranges = {"day":{"lower": "now/d", "higher":"now+1d/d"}
                   ,"week":{"lower": "now/w", "higher":"now+1w/w"}
                   ,"month":{"lower": "now/M", "higher":"now+1M/M"}
                   ,"year":{"lower": "now/y", "higher":"now+1y/y"}
                }
    var dateRange =ranges[range]
    try {
        var todaysShippings = await client.search({
            index: SHIPPING_INDEX,
            type: 'doc',
            size: 2500,
            body: {
                "query": {
                    "range": {
                        "submissionDate": {
                            "gte": dateRange.lower,
                            "lt": dateRange.higher
                        }
                    }
                }
            }
        }
        );
        return todaysShippings;
    }
    catch (e) {
        logger.log('error', "Error in Elastic Search - find todaysShippings " + ":" + JSON.stringify(e))
        throw e;
    }
}//retrieveTodaysShippings


logisticsModel.retrieveOpenShippings = async function () {
    try {
        // "new",
        // "picking",
        // "handedOverToParcelDelivery",
        // "delivered",
        // "lost",
        // "canceled"
        var openShippings = await client.search({
            index: SHIPPING_INDEX,
            type: 'doc',
            size: 500,
            body: {
                "query": {
                    "bool": {
                        "must_not": [
                            {
                                "match_phrase": {
                                    "shippingStatus": "delivered"
                                }
                            },
                            {
                                "match_phrase": {
                                    "shippingStatus": "canceled"
                                }
                            }
                        ],
                        "minimum_should_match": 1
                    }
                }
            }
        }
        );
        return openShippings;
    }
    catch (e) {
        logger.log('error', "Error in Elastic Search - find openshippings " + ":" + JSON.stringify(e))
        throw e;
    }
}

logisticsModel.cancelShipping = async function (shippingId) {
    try {

        var cancelResult = await client.update({
            index: SHIPPING_INDEX,
            type: 'doc',
            id: shippingId,
            body: {
                "script": {
                    "source": "if (ctx._source['shippingStatus']=='new') {ctx._source['shippingStatus'] = 'canceled'} else {ctx.op = 'none'}",
                    "lang": "painless"
                }
            }
        }
        );
        return cancelResult;
    }
    catch (e) {
        if (e.status = 404) {
            logger.log('info', "Shipping Document was not found")
            return {};
        }
        else {
            logger.log('error', "Error in Elastic Search - find openshippings " + ":" + JSON.stringify(e))


            throw e;
        }
    }
}

logisticsModel.saveProductStockTransaction = async function (stocktransaction) {
    try {
        var response = await client.index({
            index: WAREHOUSE_INDEX,
            type: 'stocktransaction',
            body: stocktransaction
        }
        );

        logger.log('info', "Response: " + JSON.stringify(response));
        return stocktransaction;
    }
    catch (e) {
        logger.log('error', "Error in Elastic Search - create stocktransaction document :" + JSON.stringify(e))
        throw e
    }

}

//products is an array of strings with product identifiers: e.g. ["42371XX", "XCZ"]
logisticsModel.retrieveProductStock = async function (products, includeSortedTransactions) {
    try {
        var productStock = await client.search({
            index: WAREHOUSE_INDEX,
            type: 'stocktransaction',
            body: {
                "size": includeSortedTransactions ? 1000 : 0,
                "query": products ? {
                    "terms": {
                        "productIdentifier": products
                    }
                } : { "match_all": {} },
                "sort": [
                    { "timestamp": { "order": "desc" } }
                ],
                "aggs": {
                    "by_product": {
                        "terms": {
                            "field": "productIdentifier"
                            , "size": 100
                        },
                        "aggs": {
                            "stock_count": {
                                "sum": {
                                    "field": "quantityChange"
                                }
                            }
                        }
                    }
                }
            }
        }
        );
        var stock = {};

        productStock.aggregations.by_product.buckets.forEach(function (bucket) {
            stock[bucket.key] = bucket.stock_count.value;
            logger.log('info', "Stock for " + bucket.key + " = " + bucket.stock_count.value)
        })
        if (includeSortedTransactions) {
            stock.transactions = productStock.hits.hits.reduce(function (stockTransactions, item) {
                stockTransactions.push(item._source)
                return stockTransactions
            }, [])
        }
        return stock;
    }
    catch (e) {
        logger.log('error', "Error in Elastic Search - find productStock " + ":" + JSON.stringify(e))
        throw e;
    }
}


//products is an array of strings with product identifiers: e.g. ["42371XX", "XCZ"]
logisticsModel.retrieveProducts = async function (products) {
    logger.log('info', 'retrieveProducts - start')
    try {
        var products = await client.search({
            index: PRODUCTS_INDEX,
            type: 'doc',
            body: {
                "size": 400,
                "query": products ? {
                    "terms": {
                        "id": products
                    }
                } : {
                        "match_all": {}
                    }
            }
        });
        logger.log('info', `retrieveProducts - end ${JSON.stringify(products)}`)

        return products;
    } catch (e) { logger.log('info', "Exception in retrieve products " + JSON.stringify(e)) }
}

logisticsModel.deleteProduct = async function (documentId) {
    try {
        var response = await
            client.delete({
                index: PRODUCTS_INDEX,
                type: 'doc',
                id: documentId
            }, function (error, response) {
                if (error) {
                    logger.log('info', "error occurred when deleting product with doc id " + documentId)
                    logger.log('info', JSON.stringify(error))
                } else {
                    logger.log('info', " deleted product with doc id " + documentId)

                }

            })
    }
    catch (e) {
        logger.log('error', "Error in Elastic Search Delete Product - index document " + documentId + ":" + JSON.stringify(e))
    }

}

logisticsModel.saveProduct = async function (product) {
    try {
        var response = await client.index({
            index: PRODUCTS_INDEX,
            //            id: shipping.shippingId,
            type: 'doc',
            body: product
        }
        );

        logger.log('info', "Response: " + JSON.stringify(response));
        return product;
    }
    catch (e) {
        logger.log('error', "Error in Elastic Search Save Product - index document " + product.id + ":" + JSON.stringify(e))
    }

}

//products is an array of strings with product identifiers: e.g. ["42371XX", "XCZ"]
logisticsModel.retrieveShippingsForProduct = async function (productIdentifier) {
    try {
        var products = await client.search({
            index: 'shipping',
            type: 'doc',
            body: {
                "query": {
                    "match": {
                        "items.productIdentifier": productIdentifier
                    }
                }
            }
        });
        return products;
    } catch (e) { }
}


logisticsModel.retrieveShippingForOrder = async function (orderIdentifier) {
    try {
        var shipping = await client.search({
            index: 'shipping',
            type: 'doc',
            body: {
                "query": {
                    "match": {                        
                            "orderIdentifier": {
                              "query": orderIdentifier
                            }
                    }
                }
            }
        });
        return shipping;
    } catch (e) { }
}

// try queries via Kibana
//http://129.150.114.134:5601/app/kibana#/dev_tools/console?_g=(refreshInterval:('$$hashKey':'object:796',display:'30%20seconds',pause:!f,section:1,value:30000),time:(from:now%2Fw,mode:quick,to:now%2Fw))
// GET warehouse/_search
// {
//   "size": 0,
//   "query": {},
//   "sort": [
//     {
//       "timestamp": {
//         "order": "desc"
//       }
//     }
//   ],
//   "aggs": {
//     "by_product": {
//       "terms": {
//         "field": "productIdentifier"
//          ,"size": 100
//       },
//       "aggs": {
//         "stock_count": {
//           "sum": {
//             "field": "quantityChange"
//           }
//         }
//       }
//     }
//   }
// }
// POST warehouse/_delete_by_query
// {
//   "query": { 
//     "match": {
//       "productIdentifier": "5a9a76975f150300017ff1b0"
//     }
//   }
// }
// POST products/_delete_by_query
// {
//   "query": { 
//     "match": {
//       "id": "5a9a76975f150300017ff1b0"
//     }
//   }
// }

// FIND shippings that contain a specific product:
//
// GET shipping/_search
// {"query": {
//     "match": {
//       "items.productIdentifier": "5a9aae995f150300017ff1b2" 
//     }
//   }
// }

async function deduplicateProducts() {
    var productResult = await client.search({
        index: PRODUCTS_INDEX,
        type: 'doc',
        body: {
            "size": 400,
            "query": {}
        }
    });
    // todo iterate over all products
    var products = productResult.hits.hits;
    // if 
    products.reduce(function (uniqueProducts, item) {
        var product = item._source
        logger.log('info', product.id)
        if (uniqueProducts[product.id]) {
            logger.log('info', 'seen it before, go and remove document with id ' + item._id)
            logisticsModel.deleteProduct(item._id)
        } else {
            logger.log('info', 'first encounter')
            uniqueProducts[product.id] = 1
        }
        return uniqueProducts
    }, { 'porp1': 0 })

    //   logger.log('info',JSON.stringify(products));

}
// setTimeout(function () {
//     deduplicateProducts();
// }, 1500)