ratify
======

A Hapi plugin for validating the schema of path, query, request body, and response body params using [JSON-schema](http://json-schema.org/), while providing documenation for your end points via [Swagger](https://helloreverb.com/developers/swagger)


[![Build Status](https://secure.travis-ci.org/mac-/ratify.png)](http://travis-ci.org/mac-/ratify)
[![Coverage Status](https://coveralls.io/repos/mac-/ratify/badge.png)](https://coveralls.io/r/mac-/ratify)
[![NPM version](https://badge.fury.io/js/ratify.png)](http://badge.fury.io/js/ratify)
[![Dependency Status](https://david-dm.org/mac-/ratify.png)](https://david-dm.org/mac-/ratify)

[![NPM](https://nodei.co/npm/ratify.png?downloads=true&stars=true)](https://nodei.co/npm/ratify/)

## Installation

	npm install ratify

## Usage

To install this plugin on your Hapie server, do something similar to this:

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

### Currently compatible with: Hapi 6.x.x

* 0.2.x - Hapi 1.x.x
* 0.3.x - Don't use!
* 0.4.x - Hapi 4.x.x
* 0.5.x - Hapi 6.x.x

