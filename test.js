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
      onRequire: require('./lib/instrumentation')
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

  describe('consume', () => {
    const queueName = exchangeName + ':q';

    beforeEach(done => {
      const queue = connection.queue({queue: queueName, durable: false});
      queue.declare(() => {
        queue.bind(exchangeName, '', () => {
          done();
        });
      });
    });

    it('should record consume transaction', done => {
      connection.consume(queueName, {prefetchCount: 1}, envelope => {
        const tx = helper.getTransaction();
        assert.isNotNull(tx);
        assert.equal(tx.getFullName(), `OtherTransaction/Message/RabbitMQ/Queue/Named/${queueName}`);
        assert.isNotEmpty(envelope.properties.headers);
        assert.property(envelope.properties.headers, 'NewRelicTransaction');
        envelope.ack();
        helper.agent.on('transactionFinished', () => done());
      });

      helper.runInTransaction('background', tx => {
        connection.publish(exchangeName, '', 'hello');
        tx.end();
      });
    });

    it('should apply cross application tracing', done => {
      let tripId;
      connection.consume(queueName, {prefetchCount: 1}, envelope => {
        const tx = helper.getTransaction();
        assert.isDefined(tx.tripId);
        assert.equal(tx.tripId, tripId);
        assert.hasAllKeys(envelope.properties.headers, ['NewRelicID', 'NewRelicTransaction']);
        envelope.ack();
        done();
      });

      helper.runInTransaction('background', tx => {
        tripId = tx.tripId || tx.id;
        connection.publish(exchangeName, '', 'hello', {});
        tx.end();
      });
    });

    it('should finish transaction when the message is acknowledged', done => {
      connection.consume(queueName, {prefetchCount: 1}, envelope => {
        setTimeout(() => {
          assert.isNotNull(helper.getTransaction());
          envelope.ack();
          helper.agent.on('transactionFinished', () => done());
        }, 10);
      }, () => {});

      helper.runInTransaction('background', tx => {
        connection.publish(exchangeName, '', 'hello');
        tx.end();
      });
    });
  });
});
