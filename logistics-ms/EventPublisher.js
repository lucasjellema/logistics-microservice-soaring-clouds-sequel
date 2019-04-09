// before running, either globally install kafka-node  (npm install kafka-node)
// or add kafka-node to the dependencies of the local application

var kafka = require('kafka-node')
var Producer = kafka.Producer
KeyedMessage = kafka.KeyedMessage;

var client;
KeyedMessage = kafka.KeyedMessage;

var APP_VERSION = "0.8.5"
var APP_NAME = "EventBusPublisher"

// from the Oracle Event Hub - Platform Cluster Connect Descriptor

var topicName = process.env.SOARING_SHIPPINGNEWS_TOPIC_NAME||"soaring-shippingnews";
var EVENT_HUB_PUBLIC_IP = process.env.EVENT_HUB_HOST || '130.61.35.61';

// from the Oracle Event Hub - Platform Cluster Connect Descriptor
var kafkaConnectDescriptor = EVENT_HUB_PUBLIC_IP;

console.log("Running Module " + APP_NAME + " version " + APP_VERSION);

function initializeKafkaProducer(attempt) {
    try {
      
  
      console.log(`Try to initialize Kafka Client at ${kafkaConnectDescriptor} and Producer, attempt ${attempt}`);
      client = new kafka.Client(kafkaConnectDescriptor);
      console.log("created client");
      producer = new Producer(client);
      console.log("submitted async producer creation request");
      producer.on('ready', function () {
        console.log("Producer is ready in " + APP_NAME);
      });
      producer.on('error', function (err) {
        console.log("failed to create the client or the producer " + JSON.stringify(err));
      })
    }
    catch (e) {
      console.log("Exception in initializeKafkaProducer" + e);
      console.log("Exception in initializeKafkaProducer" + JSON.stringify(e));
      console.log("Try again in 5 seconds");
      setTimeout(initializeKafkaProducer, 5000, ++attempt);
    }
  }//initializeKafkaProducer
  initializeKafkaProducer(1);

  

  var eventPublisher = module.exports;


  eventPublisher.publishEvent = function (eventKey, event) {
    km = new KeyedMessage(eventKey, JSON.stringify(event));
    payloads = [
      { topic: topicName, messages: [km], partition: 0 }
    ];
    producer.send(payloads, function (err, data) {
      if (err) {
        console.error("Failed to publish event with key " + eventKey + " to topic " + topicName + " :" + JSON.stringify(err));
      }
      console.log("Published event with key " + eventKey + " to topic " + topicName + " :" + JSON.stringify(data));
    });
  
  }

  function getTimestampAsString() {
    var sd = new Date();
    return sd.getUTCFullYear() + '-' + (sd.getUTCMonth() + 1) + '-' + sd.getUTCDate() + 'T' + sd.getUTCHours() + ':' + sd.getUTCMinutes() + ':' + sd.getSeconds();
}


  eventPublisher.publishShippingEvent = function(shipping) {
    eventPublisher.publishEvent("ShippingEvent", {
      "eventType": "ShippingEvent"
      , "payload": shipping
      , "module": "logistics.microservice"
      , "transactionIdentifier": shipping.shippingId
      , "timestamp": getTimestampAsString()
  }, "XXXtopicName");

  }
  
