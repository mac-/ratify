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
			headers: 'headers'
		},

		constructSchemaKey = function(validationType, routeMethod, routePath) {
			return validationType + ':' + routeMethod + '|' + routePath;
		},

		forEachValidationOption = function(route, iterator) {
			var validationOptions;
			if (route.settings.plugins && route.settings.plugins[pluginName]) {
				validationOptions = route.settings.plugins[pluginName];
				for (var prop in validationOptions) {
					if (validationOptions.hasOwnProperty(prop)) {
						iterator(validationOptions[prop], prop);
					}
				}
			}
		},

		compileSchemasForRoute = function(route, callback) {
			var compileFuncs = {};

			forEachValidationOption(route, function(validationOption, validationType) {
				var validationSchema = (validationType === 'response') ? validationOption.schema : validationOption;
				(function(key, schema) {
					compileFuncs[key] = function(callback) {
						validator.compileSchema(schema, callback);
					};
				}(constructSchemaKey(validationOption, route.method, route.path), validationSchema));
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

		validate = function(route, validationType, objectToValidate) {
			var schemas = getCompiledSchemasForRoute(route);
			if (!schemas || !schemas[validationType]) {
				return { valid: true };
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

				async.parallel(compileFuncs, function(err, result) {
					if (err) {
						// log?
						return next(err);
					}
					_.extend(compiledSchemasByServerUri[serverUri], result);
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
					objToValidate = request[requestValidationTypeMap[prop]];
					report = validate(request._route, prop, objToValidate);
					if (!report.valid) {
						errorMessages = prop + ' parameters validation error: ' +
										_.map(report.errors, function(error) { return error.message; }).join(', ');
						break;
					}
				}
			}
			next(errorMessages ? Hapi.error.badRequest(errorMessages) : null);
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
					return next(Hapi.error.internal('Cannot validate non-object response'));
				}
				
				report = validate(request._route, 'response', request._response.raw);
				if (!report.valid) {
					errorMessages = 'response body validation error: ' +
									_.map(report.errors, function(error) { return error.message; }).join(', ');

					if (request.route.plugins[pluginName].response.failAction === 'log') {
						request.log(['validation', 'error'], errorMessages);
						return next();
					}

					return next(Hapi.error.internal(errorMessages));
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