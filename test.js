const utils = require('@newrelic/test-utilities');

describe('newrelic-amqp-coffee', () => {
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
      const exchange = connection.exchange({exchange: 'newrelic:test'});
      exchange.declare(() => {
        const queue = connection.queue({queue: 'newrelic:test:q'});
        queue.declare(done);
      });
    });
  });

  afterEach(() => {
    helper && helper.unload();
  });

  it('should work', done => {
    helper.agent.on('transactionFinished', tx => {
      console.log('transaction finished');
      connection.close();
      done();
    });
    helper.runInTransaction('background', tx => {
      console.log('transaction started');
      connection.publish('newrelic:test', '', 'hello', () => {
        tx.end();
      });
    });
  });
});
