const utils = require('@newrelic/test-utilities');
const {assert} = require('chai');

describe('newrelic-amqp-coffee', () => {
  const exchangeName = 'newrelic:coffee:test';
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
      const exchange = connection.exchange({exchange: exchangeName, durable: false, autoDelete: true});
      exchange.declare(() => {
        done();
      });
    });
  });

  afterEach(done => {
    helper && helper.unload();
    connection && connection.close();
    done();
  });

  it('should record publish segment', done => {
    helper.agent.on('transactionFinished', tx => {
      const segments = tx.trace.root.getChildren();
      assert.lengthOf(segments, 1);
      assert.equal(segments[0].name, `MessageBroker/RabbitMQ/Exchange/Produce/Named/${exchangeName}`);
      done();
    });
    helper.runInTransaction('background', tx => {
      connection.publish(exchangeName, '', 'hello', () => {
        tx.end();
      });
    });
  });

  it('should record consume segment', done => {
    let queueName = exchangeName + ':q';
    const queue = connection.queue({queue: queueName, durable: false, autoDelete: true});
    queue.declare(() => {
      queue.bind(exchangeName, '', () => {
        connection.consume(queueName, {}, envelope => {
          const tx = helper.getTransaction();
          assert.isDefined(tx);
          assert.equal(tx.getFullName(), `OtherTransaction/Message/RabbitMQ/Queue/Named/${queueName}`);
          assert.isNotEmpty(envelope.properties.headers);
          assert.property(envelope.properties.headers, 'NewRelicTransaction');
          done();
        }, () => {});
        helper.runInTransaction('background', tx => {
          connection.publish(exchangeName, '', 'hello', {}, () => {
            tx.end();
          });
        });
      });
    });
  });
});
