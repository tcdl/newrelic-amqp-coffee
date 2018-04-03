
module.exports = function instrumentAmqpCoffee(shim, AMQP) {
  shim.setLibrary(shim.RABBITMQ);

  shim.recordProduce(AMQP.prototype, 'publish', (shim, fn, name, args) => {
    // expected args content: exchange, routingKey, data, [publishOptions], [callback]

    const exchangeName = args[0];

    // if publishOptions arg is not passed, add it as empty object
    if (typeof(args[3]) !== 'object') {
      args.splice(3, 0, {});
    }
    const publishOptions = args[3];

    // populate publishOptions.headers if doesn't exist
    if (!publishOptions.headers) {
      publishOptions.headers = {};
    }

    return {
      callback: shim.LAST,
      destinationName: exchangeName,
      destinationType: shim.EXCHANGE,
      headers: publishOptions.headers,
      parameters: {}
    };
  });

  shim.recordSubscribedConsume(AMQP.prototype, 'consume', {
    destinationName: shim.FIRST,
    destinationType: shim.QUEUE,
    queue: shim.FIRST,
    consumer: shim.THIRD,
    messageHandler
  });
};

const messageHandler = (shim, fn, name, args) => {
  const tx = shim.tracer.getTransaction();
  tx.handledExternally = true;
  const msg = args[0];
  shim.wrap(msg, 'ack', function wrapAck(shim, fn) {
    return function wrappedAck() {
      tx.end();
      return fn.apply(this, arguments);
    }
  });
  const headers = msg.properties.headers;
  return {
    headers: headers,
    parameters: {}
  };
};
