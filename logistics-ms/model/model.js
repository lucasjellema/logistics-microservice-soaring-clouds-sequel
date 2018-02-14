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
        body: shipping}
    );

    console.log("Response: " +JSON.stringify(response));
    // TODO: add call to Elastic Search to save shipping to index
    return shipping;
}
catch (e) {
    console.error("Error in Elastic Search - index document "+shipping.shippingId+":"+JSON.stringify(e))
}

}

logisticsModel.retrieveShipping = async function (shippingId) {
    try {
    var shipping = await client.get({ 
        index: 'shipping',
        id: shippingId,
        type: 'doc'}
    );
    return shipping;
}
catch (e) {
    console.error("Error in Elastic Search - get document "+shippingId+":"+JSON.stringify(e))
    throw e;
}

}