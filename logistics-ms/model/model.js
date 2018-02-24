var logisticsModel = module.exports;
var elasticsearch = require('elasticsearch');

var ELASTIC_SEARCH_HOST = process.env.ELASTIC_CONNECTOR || 'http://129.150.114.134:9200';

var client = new elasticsearch.Client({
    host: ELASTIC_SEARCH_HOST,
});

client.ping({
    requestTimeout: 30000,
}, function (error) {
    if (error) {
        console.error('elasticsearch cluster is down!');
    } else {
        console.log('Connection to Elastic Search is established');
    }
});

logisticsModel.saveShipping = async function (shipping) {
    try {
        var response = await client.index({
            index: 'shipping',
            id: shipping.shippingId,
            type: 'doc',
            body: shipping
        }
        );

        console.log("Response: " + JSON.stringify(response));
        return shipping;
    }
    catch (e) {
        console.error("Error in Elastic Search - index document " + shipping.shippingId + ":" + JSON.stringify(e))
    }

}

logisticsModel.updateShipping = async function (shipping) {
    try {
        var response = await client.update({
            retryOnConflict: 3,
            index: 'shipping',
            id: shipping.shippingId,
            type: 'doc',
            body: { "doc": shipping }
        }
        );

        console.log("Response: " + JSON.stringify(response));
        return shipping;
    }
    catch (e) {
        console.error("Error in Elastic Search - update document " + shipping.shippingId + ":" + JSON.stringify(e))
    }

}


logisticsModel.retrieveShipping = async function (shippingId) {
    try {
        var shipping = await client.get({
            index: 'shipping',
            id: shippingId,
            type: 'doc'
        }
        );
        return shipping;
    }
    catch (e) {
        console.error("Error in Elastic Search - get document " + shippingId + ":" + JSON.stringify(e))
        throw e;
    }
}
logisticsModel.retrieveOpenShippings = async function () {
    try {
        // "new",
        // "picking",
        // "handedOverToParcelDelivery",
        // "delivered",
        // "lost",
        // "canceled"
        var openShippings = await client.search({
            index: 'shipping',
            type: 'doc',
            body: {
                "query": {
                    "bool": {
                        "must_not": [
                            {
                                "match_phrase": {
                                    "shippingStatus": "lost"
                                }
                            },
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
        console.error("Error in Elastic Search - find openshippings " + ":" + JSON.stringify(e))
        throw e;
    }
}

logisticsModel.cancelShipping = async function (shippingId) {
    try {
 
        var cancelResult = await client.update({
            index: 'shipping',
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
            console.log("Shipping Document was not found")
            return {};
        }
        else {
            console.error("Error in Elastic Search - find openshippings " + ":" + JSON.stringify(e))
        
        
        throw e;
        }
    }
}

logisticsModel.saveProductStockTransaction = async function (stocktransaction) {
    try {
        var response = await client.index({
            index: 'warehouse',
            type: 'stocktransaction',
            body: stocktransaction
        }
        );

        console.log("Response: " + JSON.stringify(response));
        return stocktransaction;
    }
    catch (e) {
        console.error("Error in Elastic Search - create stocktransaction document :" + JSON.stringify(e))
        throw e
    }

}

//products is an array of strings with product identifiers: e.g. ["42371XX", "XCZ"]
logisticsModel.retrieveProductStock = async function (products, includeSortedTransactions) {
    try {
        var productStock = await client.search({
            index: 'warehouse',
            type: 'stocktransaction',
            body: {
                "size": includeSortedTransactions?1000:0,
                "query": products ? {
                    "terms": {
                        "productIdentifier": products
                    }
                } : {},
                "sort" : [
                    { "timestamp" : {"order" : "desc"}}
                    ],
                "aggs": {
                    "by_product": {
                        "terms": {
                            "field": "productIdentifier"
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
            console.log("Stock for " + bucket.key + " = " + bucket.stock_count.value)
        })
        if (includeSortedTransactions){
            stock.transactions = productStock.hits.hits.reduce(function (stockTransactions, item) {
                stockTransactions.push(item._source)
                return stockTransactions
            }, [])
        }
        return stock;
    }
    catch (e) {
        console.error("Error in Elastic Search - find productStock " + ":" + JSON.stringify(e))
        throw e;
    }
}


//products is an array of strings with product identifiers: e.g. ["42371XX", "XCZ"]
logisticsModel.retrieveProducts = async function (products) {
    try {
        var products = await client.search({
            index: 'products',
            type: 'doc',
            body: {
                "query": products ? {
                    "terms": {
                        "id": products
                    }
                } : {}
            }
        });
        return products;
    } catch (e) { }
}

logisticsModel.saveProduct = async function (product) {
    try {
        var response = await client.index({
            index: 'products',
//            id: shipping.shippingId,
            type: 'doc',
            body: product
        }
        );

        console.log("Response: " + JSON.stringify(response));
        return product;
    }
    catch (e) {
        console.error("Error in Elastic Search Save Product - index document " + product.id + ":" + JSON.stringify(e))
    }

}
