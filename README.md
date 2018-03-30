# newrelic-amqp-coffee

A NewRelic instrumentation for amqp-coffee. Instruments `publish` and `consume` methods of `Connection`.
Supports cross-application tracing by passing/extracting NewRelic headers in AMQP messages.

## Installation
```
$ npm install newrelic-amqp-coffee
```

## Usage
```
require('newrelic-amqp-coffee');
```
The line above must be put before `amqp-coffee` is required.
