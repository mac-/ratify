var _ = require('underscore'),
	RouteSchemaManager = require('./RouteSchemaManager');

var RequestValidator = function(plugin, pluginName) {

	var routeSchemaManager = new RouteSchemaManager({ pluginName: pluginName }),

		onRequest = function(request, next) {
			// hand routes for this server to schema manager so it can compile the schemas for each route
			// this method will not attempt to compile them more than once, so this is safe to call on every request
			routeSchemaManager.initializeRoutes(request.server.info.uri, request.server.routingTable(), next);
		},

		onPreHandler = function(request, next) {
			var report, errorMessages;

			report = routeSchemaManager.validatePath(request);
			if (!report.valid) {
				errorMessages = 'path parameters validation error: ' +
								_.map(report.errors, function(error) { return error.message; }).join(', ');
				return next(plugin.hapi.error.badRequest(errorMessages));
			}

			report = routeSchemaManager.validateQuery(request);
			if (!report.valid) {
				errorMessages = 'query parameters validation error: ' +
								_.map(report.errors, function(error) { return error.message; }).join(', ');
				return next(plugin.hapi.error.badRequest(errorMessages));
			}

			report = routeSchemaManager.validateHeaders(request);
			if (!report.valid) {
				errorMessages = 'header parameters validation error: ' +
								_.map(report.errors, function(error) { return error.message; }).join(', ');
				return next(plugin.hapi.error.badRequest(errorMessages));
			}

			report = routeSchemaManager.validatePayload(request);
			if (!report.valid) {
				errorMessages = 'payload parameters validation error: ' +
								_.map(report.errors, function(error) { return error.message; }).join(', ');
				return next(plugin.hapi.error.badRequest(errorMessages));
			}

			next();
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
					if (request._response.varieties.cached) {
						return next();
					}
					return next(plugin.hapi.error.internal('Cannot validate non-object response'));
				}
				
				report = routeSchemaManager.validateResponse(request);
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