const KafkaAvro = require('kafka-avro');
//const logger = require('./logger');

const logger = {debug:function (message){console.log(message)}
, info: function (message){console.log(message)}
, error:function (message){console.log(message)} }

var kafkaAvro;

var kafkaBrokerVar = `${process.env.KAFKA_HOST}:9092` || 'localhost:9092';
var kafkaRegistryVar = process.env.SCHEMA_REGISTRY || 'http://130.61.35.61:8081';

//topics as they are defined on Kafka
const SHIPMENT_PICKED_TOPIC = process.env.KAFKA_SHIPMENT_PICKED_TOPIC || 'soaring-orderpicked';

var APP_VERSION = "0.0.3"
var APP_NAME = "AvroEventPublisher"
console.log("Running Module " + APP_NAME + " version " + APP_VERSION);

exports.initKafkaAvro = function () {
    console.log("initKafkaAvro")
    kafkaAvro = new KafkaAvro(
            {
                kafkaBroker: kafkaBrokerVar,
                schemaRegistry: kafkaRegistryVar,
                parseOptions: {wrapUnions: true}
            }
    );
    logger.debug("kafkaBroker: " + kafkaBrokerVar);
    logger.debug("kafkaRegistryVar: " + kafkaRegistryVar);
    kafkaAvro.init()
            .then(function () {
                logger.info('Kafka Avro Ready to use');
                console.log("initKafkaAvro - Kafka is ready")

            });
};

exports.publishShipmentPicked = function (payload) {
    logger.debug('publishing shipment picked event ' + JSON.stringify(payload));
    console.log('publishing shipment picked event ' + JSON.stringify(payload))

    kafkaAvro.getProducer({
    }).then(function (producer) {
        var topicName = SHIPMENT_PICKED_TOPIC;

        producer.on('disconnected', function (arg) {
            logger.info('producer disconnected. ' + JSON.stringify(arg));
        });

        producer.on('event.error', function (err) {
            logger.error('Error from producer');
            logger.error(err);
            console.log('error in publishing shipment picked event ' + JSON.stringify(err))
            
        });

        producer.on('delivery-report', function (err, report) {
            logger.info('in delivery report');
            if (err) {
                logger.error('error occurred: ' + err);
            } else {
                logger.info('delivery-report: ' + JSON.stringify(report));
            }
        });


        // var topic = producer.Topic(topicName, {
        //     'request.required.acks': 1
        // });

        var key = payload.orderId;
        //var key = 'test_key_from_real_code';
        logger.debug('key: ' + key);
        var partition = -1;
        logger.debug('event: ' + JSON.stringify(payload));
        // producer.produce(topic, partition, payload, key);
        // https://www.npmjs.com/package/kafka-avro
        producer.produce(topicName, partition, payload, key);


    }).catch(function (exception) {
        logger.error("exception: " + exception);
        console.log('error in publishing shipment picked event ' + JSON.stringify(exception))
    });

};


