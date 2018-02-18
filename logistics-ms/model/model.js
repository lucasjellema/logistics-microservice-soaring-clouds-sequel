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
        console.error("Error in Elastic Search - index document " + shipping.shippingId + ":" + JSON.stringify(e))
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

//products is an array of strings with product identifiers: e.g. ["42371XX", "XCZ"]
logisticsModel.retrieveProductStock = async function (products) {
    try {
        var productStock = await client.search({
            index: 'warehouse',
            type: 'stocktransaction',
            body: {
                "size": 0,
                "query": {
                    "terms": {
                        "productIdentifier": products
                    }
                },
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
        productStock.aggregations.by_product.buckets.forEach(function(bucket) {
            stock[bucket.key] = bucket.stock_count.value;
            console.log("Stock for "+bucket.key+" = "+bucket.stock_count.value)})
        return stock;
    }
    catch (e) {
        console.error("Error in Elastic Search - find productStock " + ":" + JSON.stringify(e))
        throw e;
    }
}
