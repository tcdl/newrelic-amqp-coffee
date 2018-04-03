const newrelic = require('newrelic');
newrelic.instrumentMessages('amqp-coffee', require('./instrumentation'));
