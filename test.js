const utils = require('@newrelic/test-utilities');
const {assert} = require('chai');

describe('newrelic-amqp-coffee', () => {
  const exchangeName = 'newrelic:test';
  let helper;
  let connection;

  beforeEach(done => {
    helper = utils.TestAgent.makeInstrumented();
    helper.registerInstrumentation({
      moduleName: 'amqp-coffee',
      type: 'message',
      onRequire: require('./instrumentation')
    });
    const AMQP = require('amqp-coffee');
    connection = new AMQP({host: 'localhost'}, () => {
      const exchange = connection.exchange({exchange: exchangeName});
      exchange.declare(() => {
        done();
        // const queue = connection.queue({queue: 'newrelic:test:q'});
        // queue.declare(done);
        // queue.bind(exchange)
      });
    });
  });

  afterEach(done => {
    helper && helper.unload();
    connection.close();
    done();
  });

  it('should record publish segment', done => {
    helper.agent.on('transactionFinished', tx => {
      console.log('transaction finished');
      const segments = tx.trace.root.getChildren();
      assert.lengthOf(segments, 1);
      assert.equal(segments[0].name, `MessageBroker/RabbitMQ/Exchange/Produce/Named/${exchangeName}`);
      done();
    });
    helper.runInTransaction('background', tx => {
      console.log('transaction started');
      connection.publish(exchangeName, '', 'hello', () => {
        tx.end();
      });
    });
  });
});
