
module.exports = function instrumentAmqpCoffee(shim, AMQP, moduleName) {
  shim.setLibrary(shim.RABBITMQ);

  shim.recordProduce(AMQP.prototype, 'publish', (shim, fn, name, args) => {
    console.log('record produce');
    const exchangeName = args[0];
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

  const messageHandler = (shim, fn, name, args) => {
    console.log('record consume');
    const tx = shim.tracer.getTransaction();
    tx.handledExternally = true;
    const msg = args[0];
    shim.wrap(msg, 'ack', function wrapAck(shim, fn) {
      return function wrappedAck() {
        console.log('wrapped ack called');
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

  shim.recordSubscribedConsume(AMQP.prototype, 'consume', {
    destinationName: shim.FIRST,
    destinationType: shim.QUEUE,
    queue: shim.FIRST,
    consumer: shim.LAST - 1,
    messageHandler
  });
};
