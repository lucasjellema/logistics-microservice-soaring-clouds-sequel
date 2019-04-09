var ELASTIC_SEARCH_HOST = process.env.ELASTIC_CONNECTOR || 'http://129.213.11.15/soaring/elastic';

var elasticsearch = require('elasticsearch'); // documentation: https://github.com/elastic/elasticsearch-js 

var client = new elasticsearch.Client({
    host: ELASTIC_SEARCH_HOST,
});

const SHIPPING_INDEX = 'shipping'
const WAREHOUSE_INDEX = 'warehouse'
const PRODUCTS_INDEX = 'products'

// see article https://medium.com/terragoneng/elastic-search-index-and-mapping-in-node-js-97d8f480e3c7 for introduction to Elastic Search node client
client.ping((error) => {
    if (error) {
        console.trace('elasticsearch cluster is down!');
    } console.log('All is well');
});

async function getAllProducts() {
    var productIds = null; //['DROP-4567']
    try {
        var products = await client.search({
            index: PRODUCTS_INDEX,
            type: 'doc',
            body: {
                "size": 400,
                "query": productIds ? {
                    "terms": {
                        "id": productIds
                    }
                } : {
                        "match_all": {}
                    }
            }
        });
        return products;
    } catch (e) { console.log("Exception in retrieve products " + JSON.stringify(e)) }
}

async function getProductStock() {
    var products = ['DROP-456']
    var includeSortedTransactions = true
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
                } : {},
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
            console.log("Stock for " + bucket.key + " = " + bucket.stock_count.value)
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
        console.error("Error in Elastic Search - find productStock " + ":" + JSON.stringify(e))
        throw e;
    }
}//getProductStock

async function getAllShippings() {
    try {
        var products = await client.search({
            index: SHIPPING_INDEX,
            type: 'doc',
            body: {
                "size": 400,
                "query":  {
                        "match_all": {}
                    }
            }
        });
        return products;
    } catch (e) { console.log("Exception in retrieve shippings " + JSON.stringify(e)) }
}// getAllShippings


async function show() {
    var prods = await getAllProducts()
    console.log("All Products " + JSON.stringify(prods))

    var stock = await getProductStock()
    console.log("Stock for DROP-456 " + JSON.stringify(stock))
    var shippings = await getAllShippings()
    console.log("Shippings " + JSON.stringify(shippings))

}//show

show()