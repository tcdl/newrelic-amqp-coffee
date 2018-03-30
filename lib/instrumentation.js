
module.exports = function instrumentAmqpCoffee(shim, AMQP) {
  shim.setLibrary(shim.RABBITMQ);

  shim.recordProduce(AMQP.prototype, 'publish', (shim, fn, name, args) => {
    const exchangeName = args[0];
    if (typeof(args[3]) !== 'object') {
      args.splice(3, 0, {});
    }
    if (!args[3].headers) {
      args[3].headers = {};
    }
    const headers = args[3].headers;
    return {
      callback: shim.LAST,
      destinationName: exchangeName,
      destinationType: shim.EXCHANGE,
      headers: headers,
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
