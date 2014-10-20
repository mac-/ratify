var _ = require('underscore'),
	RouteSchemaManager = require('./RouteSchemaManager');

var RequestValidator = function(plugin, options) {
	options = options || {};
	var routeSchemaManager = new RouteSchemaManager({ pluginName: options.pluginName, log: options.log }),
		log = options.log || function(){},

		onRequest = function(request, next) {
			// hand routes for this server to schema manager so it can compile the schemas for each route
			// this method will not attempt to compile them more than once, so this is safe to call on every request
			try {
				routeSchemaManager.initializeRoutes(request.server.info.uri, request.server.table());
			}
			catch (error){
				log('error', 'Unable to compile and validate schemas', error);
				return next(error);
			}

			next();
		},

		onPreHandler = function(request, next) {
			var report, errorMessages,
				extractErrorMessage = function extractErrorMessage(error) {
					var message = (error.description) ? error.message + '. Description: ' + error.description : error.message;
					if (error.path && error.path !== '#/'){
						message += ' - on ';
						// handles array case with second replacement
						message += error.path.substr(2).replace(/\//g, '.').replace(/\.\[/g, '[');	
					}

					if (error.inner && error.inner.length !== 0){
						message += ': ';
						message += error.inner.map(function(inner){
							return extractErrorMessage(inner);
						}).join('; ');
					}

					return message;
				};

			report = routeSchemaManager.validatePath(request);
			if (!report.valid) {
				errorMessages = 'path parameters validation error: ' +
								_.map(report.errors, function(error) { return extractErrorMessage(error); }).join(', ');
				return next(plugin.hapi.error.badRequest(errorMessages));
			}

			report = routeSchemaManager.validateQuery(request);
			if (!report.valid) {
				errorMessages = 'query parameters validation error: ' +
								_.map(report.errors, function(error) { return extractErrorMessage(error); }).join(', ');
				return next(plugin.hapi.error.badRequest(errorMessages));
			}

			report = routeSchemaManager.validateHeaders(request);
			if (!report.valid) {
				errorMessages = 'header parameters validation error: ' +
								_.map(report.errors, function(error) { return extractErrorMessage(error); }).join(', ');
				return next(plugin.hapi.error.badRequest(errorMessages));
			}

			report = routeSchemaManager.validatePayload(request);
			if (!report.valid) {
				errorMessages = 'payload parameters validation error: ' +
								_.map(report.errors, function(error) { return extractErrorMessage(error); }).join(', ');
				return next(plugin.hapi.error.badRequest(errorMessages));
			}

			next();
		},

		onPostHandler = function(request, next) {
			var report, errorMessages;

			// if route config contains a schema for the respose, and sample rate is greater than 0, validate it
			if (request.route.plugins &&
				request.route.plugins[options.pluginName] &&
				request.route.plugins[options.pluginName].response &&
				request.route.plugins[options.pluginName].response.schema &&
				request.route.plugins[options.pluginName].response.sample !== 0 &&
				request.route.plugins[options.pluginName].response.sample !== false) {

				// if sampling is enabled and the random sample value is greater than the defined sample rate, don't validate
				if (request.route.plugins[options.pluginName].response.sample) {
					var currentSample = Math.ceil((Math.random() * 100));
					if (currentSample > request.route.plugins[options.pluginName].response.sample) {
						return next();
					}
				}

				if (request.response.isBoom) {
					return next();
				}

				report = routeSchemaManager.validateResponse(request);
				if (!report.valid) {
					errorMessages = 'response body validation error: ' +
									_.map(report.errors, function(error) { return error.message; }).join(', ');

					if (request.route.plugins[options.pluginName].response.failAction === 'log') {
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