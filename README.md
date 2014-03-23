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

	var ratifyConfig = {};

	server.pack.require('ratify', ratifyConfig, function(err) {
		if (err) {
			console.log('error', 'Failed loading plugin: ratify');
		}
	});

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

[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/mac-/ratify/trend.png)](https://bitdeli.com/free "Bitdeli Badge")

