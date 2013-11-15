var zSchema = require('z-schema'),
	async = require('async'),
	_ = require('underscore'),
	validator = new zSchema();

var RequestValidator = function(plugin, pluginName) {

	var compiledSchemasByServerUri = {},
		requestValidationTypeMap = {
			path: 'params',
			query: 'query',
			payload: 'payload',
			headers: 'raw.req.headers'
		},

		constructSchemaKey = function(validationType, routeMethod, routePath) {
			return validationType + ':' + routeMethod + '|' + routePath;
		},

		traverseObject = function(obj, path) {
			var parts = path.split('.'),
				result = obj;
			parts.forEach(function(part) {
				result = result[part];
			});
			return result;
		},

		forEachValidationOption = function(route, iterator) {
			var validationOptions;
			if (route.settings.plugins && route.settings.plugins[pluginName]) {
				validationOptions = route.settings.plugins[pluginName];
				for (var prop in validationOptions) {
					if (validationOptions.hasOwnProperty(prop) && (requestValidationTypeMap.hasOwnProperty(prop) || prop === 'response')) {
						iterator(validationOptions[prop], prop);
					}
				}
			}
		},

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
				var validationSchema = (validationType === 'response') ? validationOption.schema : (validationType === 'headers') ? modifyHeadersSchema(validationOption) : validationOption;
				(function(key, schema) {
					compileFuncs[key] = function(callback) {
						validator.compileSchema(schema, callback);
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
			if (schema.type === 'object' && typeof(object) === 'object' && schema.properties) {
				for (var prop in schema.properties) {
					if (schema.properties.hasOwnProperty(prop) && object.hasOwnProperty(prop)) {
						object[prop] = convertPropertyTypesToMatchSchema(object[prop], schema.properties[prop], forceArrayConversion);
					}
				}
				return object;
			}
			else if (schema.type === 'array' && typeof(object) === 'object' && object instanceof Array && schema.items) {
				for (var prop in schema.items) {
					if (schema.items.hasOwnProperty(prop)) {
						for (var i = 0; i < object.length; i++) {
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
				// make sure that if our scema calls for an integer, that there is no decimal
				if (convertedVal && (type === 'number' || (value.indexOf('.') === -1))) {
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

		validate = function(route, validationType, objectToValidate) {
			var schemas = getCompiledSchemasForRoute(route);
			if (!schemas || !schemas[validationType]) {
				return { valid: true };
			}
			// convert types before validating; payload shouldn't need to be converted since it's coming in as JSON
			if (validationType !== requestValidationTypeMap.payload) {
				objectToValidate = convertPropertyTypesToMatchSchema(objectToValidate, schemas[validationType], (validationType === requestValidationTypeMap.query));
			}
			return validator.validateWithCompiled(objectToValidate, schemas[validationType]);
		},

		onRequest = function(request, next) {
			var serverUri = request.server.info.uri;

			if (!compiledSchemasByServerUri[serverUri]) {
				compiledSchemasByServerUri[serverUri] = {};
				var compileFuncs = [];

				request.server.routingTable().forEach(function(route) {
					(function(r) {
						compileFuncs.push(function(callback) {
							compileSchemasForRoute(r, callback);
						});
					}(route));
				});

				async.parallel(compileFuncs, function(err, results) {
					if (err) {
						// log?
						return next(err);
					}
					results.forEach(function(result) {
						compiledSchemasByServerUri[serverUri] = _.extend(compiledSchemasByServerUri[serverUri], result);
					});
					next();
				});
			}
			else {
				next();
			}
		},

		onPreHandler = function(request, next) {
			var objToValidate, report, prop, errorMessages;

			for (prop in requestValidationTypeMap) {
				if (requestValidationTypeMap.hasOwnProperty(prop)) {
					objToValidate = traverseObject(request, requestValidationTypeMap[prop]);
					report = validate(request._route, prop, objToValidate);
					if (!report.valid) {
						errorMessages = prop + ' parameters validation error: ' +
										_.map(report.errors, function(error) { return error.message; }).join(', ');
						break;
					}
				}
			}
			next(errorMessages ? plugin.hapi.error.badRequest(errorMessages) : null);
		},

		onPostHandler = function(request, next) {
			var report, errorMessages;

			// if route config contains a schema for the respose, and sample rate is greater than 0, validate it
			if (request.route.plugins &&
				request.route.plugins[pluginName] &&
				request.route.plugins[pluginName].response &&
				request.route.plugins[pluginName].response.schema &&
				request.route.plugins[pluginName].response.sample !== 0 &&
				request.route.plugins[pluginName].response.sample !== false) {

				// if sampling is enabled and the random sample value is greater than the defined sample rate, don't validate
				if (request.route.plugins[pluginName].response.sample) {
					var currentSample = Math.ceil((Math.random() * 100));
					if (currentSample > request.route.plugins[pluginName].response.sample) {
						return next();
					}
				}

				if (request._response.isBoom || request._response.varieties.error) {
					return next();
				}

				if (!request._response.varieties.obj) {
					return next(plugin.hapi.error.internal('Cannot validate non-object response'));
				}
				
				report = validate(request._route, 'response', request._response.raw);
				if (!report.valid) {
					errorMessages = 'response body validation error: ' +
									_.map(report.errors, function(error) { return error.message; }).join(', ');

					if (request.route.plugins[pluginName].response.failAction === 'log') {
						request.log(['validation', 'error'], errorMessages);
						return next();
					}

					return next(plugin.hapi.error.internal(errorMessages));
				}
			}
			next();
		};

	// hook for compiling all schemas for all routes (one time)
	plugin.ext('onRequest', onRequest);
	// hook for validating request payload, query params, and path params
	plugin.ext('onPreHandler', onPreHandler);
	// hook for validating response payload
	plugin.ext('onPostHandler', onPostHandler);

};

module.exports = RequestValidator;