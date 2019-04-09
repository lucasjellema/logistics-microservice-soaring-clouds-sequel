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

async function checkIndices(indexName) {
    client.indices.exists({ index: indexName }, async (err, res, status) => {
        if (res) {
            console.log('index already exists');
        } else {
            await client.indices.create({ index: indexName }, async (err, res, status) => {
                console.log(err, res, status);
                if (!err) console.log("index is created")
            })
        }
    })
}

async function putMapping(indexName, indexType, mappingProperties) {
    console.log(`Creating Mapping index for ${indexName}`);
    client.indices.putMapping({
        index: indexName,
        type: indexType,
        body: {
            properties: mappingProperties
        }
    }, (err, resp, status) => {
        if (err) {
            console.error(err, status);
        }
        else {
            console.log('Successfully Created Index Mapping', status, resp);
        }
    });
}
async function initializeModel() {
        await checkIndices(WAREHOUSE_INDEX)
    await putMapping(WAREHOUSE_INDEX, 'stocktransaction', {
        "category": {
            "type": "keyword"
        },
        "productIdentifier": {
            "type": "keyword"
        },
        "quantityChange": {
            "type": "long"
        },
        "timestamp": {
            "type": "date",
            "format": "yyyy-MM-dd'T'HH:mm:ss"
        }
    })//putMapping
    console.log("created mapping")




    await checkIndices(SHIPPING_INDEX)
    await putMapping(SHIPPING_INDEX, 'doc', {
        "desiredDeliveryDate": {
            "type": "date",
            "format": "yyyy-MM-dd"
        },
        "destination": {
            "properties": {
                "city": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                },
                "country": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                },
                "houseNumber": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                },
                "postalCode": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                },
                "street": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                },
                "coordinates": {
                    "type": "geo_point"
                }

            }
        },
        "giftWrapping": {
            "type": "boolean"
        },
        "id": {
            "type": "text",
            "fields": {
                "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                }
            }
        },
        "items": {
            "properties": {
                "itemCount": {
                    "type": "long"
                },
                "productIdentifier": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                }
            }
        },
        "nameAddressee": {
            "type": "text",
            "fields": {
                "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                }
            }
        },
        "orderIdentifier": {
            "type": "text",
            "fields": {
                "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                }
            }
        },
        "parcels": {
            "properties": {
                "estimatedDeliveryData": {
                    "type": "date",
                    "format": "yyyy-MM-dd'T'HH:mm:ss"
                },
                "parcelDeliveryService": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                },
                "parcelLogItems": {
                    "properties": {
                        "estimatedDeliveryDate": {
                            "type": "date",
                            "format": "yyyy-MM-dd'T'HH:mm:ss"
                        },
                        "location": {
                            "type": "text",
                            "fields": {
                                "keyword": {
                                    "type": "keyword",
                                    "ignore_above": 256
                                }
                            }
                        },
                        "parcelStatus": {
                            "type": "text",
                            "fields": {
                                "keyword": {
                                    "type": "keyword",
                                    "ignore_above": 256
                                }
                            }
                        }
                    }
                },
                "trackAndTraceIdentifier": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                }
            }
        },
        "personalMessage": {
            "type": "text",
            "fields": {
                "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                }
            }
        },
        "shippingMethod": {
            "type": "text",
            "fields": {
                "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                }
            }
        },
        "shippingStatus": {
            "type": "text",
            "fields": {
                "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                }
            }
        },
        "submissionDate": {
            "type": "date",
            "format": "yyyy-MM-dd'T'HH:mm:ss"
        }
    })//putMapping shipping
    await checkIndices(PRODUCTS_INDEX)
    await putMapping(PRODUCTS_INDEX, 'doc', {
        "categories": {
            "type": "text",
            "fields": {
                "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                }
            }
        },
        "dimension": {
            "properties": {
                "height": {
                    "type": "float"
                },
                "length": {
                    "type": "float"
                },
                "unit": {
                    "type": "keyword"
                },
                "width": {
                    "type": "float"
                }
            }
        },
        "id": {
            "type": "keyword"
        },
        "name": {
            "type": "text",
            "fielddata": true,
            "fields": {
                "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                }
            }
        },
        "weight": {
            "type": "float"
        }
    }
    )//putMapping products index
}//initializeModel    

try {
initializeModel()
} catch (e) {
    console.log("Exception "+e)
}