var zSchema = require('z-schema'),
	async = require('async'),
	_ = require('underscore'),
	validator = new zSchema();


var RouteSchemaManager = function(options) {
	options = options || {};

	var compiledSchemasByServerUri = {},
		validationTypes = {
			PATH: 'path',
			QUERY: 'query',
			PAYLOAD: 'payload',
			HEADERS: 'headers',
			RESPONSE: 'response'
		},

		constructSchemaKey = function(validationType, routeMethod, routePath) {
			return validationType + ':' + routeMethod + '|' + routePath;
		},

		isValidValidationProperty = function(name) {
			for (var prop in validationTypes) {
				if (validationTypes.hasOwnProperty(prop)) {
					if (validationTypes[prop] === name) {
						return true;
					}
				}
			}
			return false;
		},

		forEachValidationOption = function(route, iterator) {
			var validationOptions;
			if (route.settings.plugins && route.settings.plugins[options.pluginName]) {
				validationOptions = route.settings.plugins[options.pluginName];
				for (var prop in validationOptions) {
					if (validationOptions.hasOwnProperty(prop) && isValidValidationProperty(prop)) {
						iterator(validationOptions[prop], prop);
					}
				}
			}
		},

		// normalize all headers names in schema to lowercase
		modifyHeadersSchema = function(schema) {
			var modifiedSchema = {};

			if (typeof(schema) !== 'object') {
				return schema;
			}
			for (var prop in schema) {
				if (schema.hasOwnProperty(prop)) {
					if (prop !== 'properties') {
						modifiedSchema[prop] = schema[prop];
					}
					else {
						modifiedSchema.properties = {};
						for (var subProp in schema.properties) {
							if (schema.properties.hasOwnProperty(subProp)) {
								modifiedSchema.properties[subProp.toLowerCase()] = modifyHeadersSchema(schema.properties[subProp]);
							}
						}
					}
				}
			}
			return modifiedSchema;
		},

		compileSchemasForRoute = function(route, callback) {
			var compileFuncs = {};

			forEachValidationOption(route, function(validationOption, validationType) {
				var validationSchema = (validationType === validationTypes.RESPONSE) ?
											validationOption.schema :
											(validationType === validationTypes.HEADERS) ?
												modifyHeadersSchema(validationOption) :
												validationOption;
				(function(key, schema) {
					compileFuncs[key] = function(cb) {
						validator.compileSchema(schema, cb);
					};
				}(constructSchemaKey(validationType, route.method, route.path), validationSchema));
			});

			async.parallel(compileFuncs, callback);
		},

		getCompiledSchemasForRoute = function(route) {
			var schemas = null,
				serverUri = route.server.info.uri;
			if (compiledSchemasByServerUri[serverUri]) {
				forEachValidationOption(route, function(validationOption, validationType) {
					schemas = schemas || {};
					var key = constructSchemaKey(validationType, route.method, route.path);
					schemas[validationType] = compiledSchemasByServerUri[serverUri][key];
				});
			}
			return schemas;
		},

		convertPropertyTypesToMatchSchema = function(object, schema, forceArrayConversion) {
			// in some cases (query params), we want to force a value to be an array that contains that value,
			// if the schema expects an array of strings, numbers, integers, or booleans
			if (forceArrayConversion && schema.type === 'array' && typeof(object) === 'string' && schema.items &&
				(schema.items.type === 'string' || schema.items.type === 'number' || schema.items.type === 'integer' || schema.items.type === 'boolean')) {
				object = [object];
			}
			var i, prop;
			if (schema.type === 'object' && typeof(object) === 'object' && schema.properties) {
				for (prop in schema.properties) {
					if (schema.properties.hasOwnProperty(prop) && object.hasOwnProperty(prop)) {
						object[prop] = convertPropertyTypesToMatchSchema(object[prop], schema.properties[prop], forceArrayConversion);
					}
				}
				return object;
			}
			else if (schema.type === 'array' && typeof(object) === 'object' && object instanceof Array && schema.items) {
				for (prop in schema.items) {
					if (schema.items.hasOwnProperty(prop)) {
						for (i = 0; i < object.length; i++) {
							object[i] = convertPropertyTypesToMatchSchema(object[i], schema.items, forceArrayConversion);
						}
					}
				}
				return object;
			}
			else {
				return convertValueFromStringToType(object, schema.type);
			}
		},

		convertValueFromStringToType = function(value, type) {
			if (typeof(value) !== 'string' || type === 'string') {
				return value;
			}
			if (type === 'integer' || type === 'number') {
				// fastest (and more reliable) way to convert strings to numbers
				var convertedVal = 1 * value;
				// make sure that if our schema calls for an integer, that there is no decimal
				if (convertedVal || convertedVal === 0 && (type === 'number' || (value.indexOf('.') === -1))) {
					return convertedVal;
				}
			}
			else if (type === 'boolean') {
				if (value === 'true') {
					return true;
				}
				else if (value === 'false') {
					return false;
				}
			}
			return value;
		},

		convertArraysInQueryString = function(queryObj) {
			var prop, newProp, idx,
				arraySyntaxRegex = /\[\d+\]$/;
			for (prop in queryObj) {
				if (queryObj.hasOwnProperty(prop)) {
					if (arraySyntaxRegex.test(prop)) {
						newProp = prop.substring(0, prop.lastIndexOf('['));
						queryObj[newProp] = queryObj[newProp] || [];
						idx = 1 * prop.substring(prop.lastIndexOf('[')+1, prop.lastIndexOf(']'));
						queryObj[newProp][idx] = queryObj[prop];
						delete queryObj[prop];
					}
				}
			}
		};

	this.initializeRoutes = function(serverUri, routes, callback) {

		if (!compiledSchemasByServerUri[serverUri]) {
			compiledSchemasByServerUri[serverUri] = {};
			var compileFuncs = [];

			routes.forEach(function(route) {
				(function(r) {
					compileFuncs.push(function(cb) {
						compileSchemasForRoute(r, cb);
					});
				}(route));
			});

			async.parallel(compileFuncs, function(err, results) {
				if (err) {
					// log?
					return callback(err);
				}
				results.forEach(function(result) {
					compiledSchemasByServerUri[serverUri] = _.extend(compiledSchemasByServerUri[serverUri], result);
				});
				callback();
			});
		}
		else {
			callback();
		}
	};

	this.validatePath = function(request) {
		var schemas = getCompiledSchemasForRoute(request._route);
		if (!schemas || !schemas[validationTypes.PATH]) {
			return { valid: true };
		}
		// convert path types before validating
		convertPropertyTypesToMatchSchema(request.params, schemas[validationTypes.PATH]);

		return validator.validateWithCompiled(request.params, schemas[validationTypes.PATH]);
	};

	this.validateQuery = function(request) {
		var schemas = getCompiledSchemasForRoute(request._route);
		if (!schemas || !schemas[validationTypes.QUERY]) {
			return { valid: true };
		}
		// convert query types before validating
		convertArraysInQueryString(request.query);
		convertPropertyTypesToMatchSchema(request.query, schemas[validationTypes.QUERY], true);

		return validator.validateWithCompiled(request.query, schemas[validationTypes.QUERY]);
	};

	this.validatePayload = function(request) {
		var schemas = getCompiledSchemasForRoute(request._route);
		if (!schemas || !schemas[validationTypes.PAYLOAD]) {
			return { valid: true };
		}

		// convert payload types before validating only if payload is type application/x-www-form-urlencoded
		if (request.raw.req.headers['content-type'].indexOf('application/x-www-form-urlencoded') === 0) {
			convertPropertyTypesToMatchSchema(request.payload, schemas[validationTypes.PAYLOAD]);
		}

		return validator.validateWithCompiled(request.payload, schemas[validationTypes.PAYLOAD]);
	};

	this.validateHeaders = function(request) {
		var schemas = getCompiledSchemasForRoute(request._route);
		if (!schemas || !schemas[validationTypes.HEADERS]) {
			return { valid: true };
		}
		// convert header types before validating
		convertPropertyTypesToMatchSchema(request.raw.req.headers, schemas[validationTypes.HEADERS], true);

		return validator.validateWithCompiled(request.raw.req.headers, schemas[validationTypes.HEADERS]);
	};

	this.validateResponse = function(request) {
		var schemas = getCompiledSchemasForRoute(request._route);
		if (!schemas || !schemas[validationTypes.RESPONSE]) {
			return { valid: true };
		}

		var response;
		try {
			response = JSON.parse(request._response._payload[0]);
		}
		catch (ex) {
			// there was a problem parsing the payload that hapi formulated... weird
			response = request._response.raw;
		}
		return validator.validateWithCompiled(response, schemas[validationTypes.RESPONSE]);
	};
};

module.exports = RouteSchemaManager;