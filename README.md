ratify
======

A Hapi plugin for validating the schema of path, query, request body, and response body params using [JSON-schema](http://json-schema.org/), while providing documenation for your end points via [Swagger](https://helloreverb.com/developers/swagger)

[![Build Status](https://secure.travis-ci.org/mac-/ratify.png)](http://travis-ci.org/mac-/ratify)
[![Coverage Status](https://coveralls.io/repos/mac-/ratify/badge.png)](https://coveralls.io/r/mac-/ratify)
[![Code Climate](https://codeclimate.com/github/mac-/ratify.png)](https://codeclimate.com/github/mac-/ratify)
[![NPM version](https://badge.fury.io/js/ratify.png)](http://badge.fury.io/js/ratify)
[![Dependency Status](https://david-dm.org/mac-/ratify.png)](https://david-dm.org/mac-/ratify)

[![NPM](https://nodei.co/npm/ratify.png?downloads=true&stars=true)](https://nodei.co/npm/ratify/)

## Contributing

This module makes use of a `Makefile` for building/testing purposes. After obtaining a copy of the repo, run the following commands to make sure everything is in working condition before you start your work:

	make install
	make test

Before committing a change to your fork/branch, run the following commands to make sure nothing is broken:

	make test
	make test-cov

Don't forget to bump the version in the `package.json` using the [semver](http://semver.org/spec/v2.0.0.html) spec as a guide for which part to bump. Submit a pull request when your work is complete.

***Notes:***
* Please do your best to ensure the code coverage does not drop. If new unit tests are required to maintain the same level of coverage, please include those in your pull request.
* Please follow the same coding/formatting practices that have been established in the module.

## Installation

	npm install ratify

## Usage

To install this plugin on your Hapi server, do something similar to this:

	var Hapi = require('hapi');
	var server = new Hapi.Server();

	var ratifyOptions = {};

	server.pack.register({ plugin: require('ratify'), options: ratifyOptions }, function(err) {
		if (err) {
			console.log('error', 'Failed loading plugin: ratify');
		}
	});

## Plugin Options

### `auth`

Used to add authentication to the swagger routes that get created by the plugin. Valid values are described [here](https://github.com/spumko/hapi/blob/master/docs/Reference.md#route-options) under the `auth` property.

Defaults to `false`

### `baseUrl`

The protocol, hostname, and port where the application is running.

Defaults to `'http://localhost'`

### `startingPath`

The path at which all of the swagger routes begin at. This is the endpoint you would pass to an instance of the swagger UI.

Defaults to `'/api-docs'`

### `apiVersion`

The version of your API.

Defaults to `''`

### `responseContentTypes`

A collection of valid response types returned by your services.

Defaults to `['application/json']`

### `swaggerHooks`

An object in which the property names represent swagger generated elements and the values must be functions to be invoked to customize how those elements are processed.

Possible values:
* `params`: `function(params, route, type)`
* `operation`: `function(operation, route, resourceType, path)`
* `routeNameGroup`: `function(route)`

### `errorReporters`

An object in which the property keys represent elements that can be validated (`"headers"`, `"query"`, `"path"`, `"payload"`, `"response"`) and the values are initialized [ZSchemaErrors instances](https://github.com/dschenkelman/z-schema-errors) to be used to report those errors.

### Parameter Validation

Once your server is set to use ratify, you can specify route-specific validations in each route config like so:

	var route = {
		method: 'GET',
		path: '/foo/{bar}',
		config: {
			handler: function(request, reply) {

			},
			plugins: {
				ratify: {
					path: {
						// path parameters schema
					},
					query: {
						// query parameters schema
					},
					headers: {
						// header parameters schema
					},
					payload: {
						// request payload schema
					},
					response: {
						schema: {
							// response payload schema
						},
						sample: 100, // percentage of responses to test against the schema
						failAction: 'log' // action to take when schena validation fails. Valid options are; 'log' and 'error'
					}

				}
			}
		}
	};
	server.route(route);

All schemas should follow the [JSON schema specification](http://json-schema.org/).

***Notes:***
In addition to the JSON schema defined types, ratify allows you to specify "file" as a payload type. If this is specified, no validation against JSON schema is performed, but swagger documentation will still be provided.

#### Type Conversion

In the process of validating the properties based on the schema, ratify will attempt to convert path, header, and query params to the type defined in the schema. For example, if you have a query paramter called `limit` and it's type is `number`, since all query parameters are parsed as strings by Hapi, ratify will convert the string to a number.

Ratify can also specifically convert query parameters that are intended to be arrays. For example, both of the following query strings will result in a property called `types` having an array value:

* `?types=first&types=second&types=third`
* `?types[0]=first&types[2]=third&types[1]=second`

Result:

```
{
	types: ['first', 'second', 'third']
}
```

### Swagger Documentation

Ratify automatically generates routes that produce JSON in the format of the [Swagger API Specification](https://github.com/wordnik/swagger-core). In order to ge tthe most of the documentation, it's best to ensure there are descriptions to all your parameters as allowed by the JSON schema spec.

## Version Compatibility

### Currently compatible with: Hapi 10.x.x (Node v4)

* 0.2.x - Hapi 1.x.x
* 0.3.x - Don't use!
* 0.4.x - Hapi 4.x.x
* 0.6.x - Hapi 6.x.x
* 0.7.x - Hapi 7.x.x
* 0.8.x - Hapi 8.x.x
* 0.10.x - Hapi 9.x.x
* 1.x.x - Hapi 10.x.x (Node v4)
* 2.x.x - Hapi 11.x.x

