var	RouteSchemaManager = require('./RouteSchemaManager');

var ZSchemaErrors = require('z-schema-errors');

var baseMessage = '{part} parameters validation error:';

var errorReporters = ['Headers', 'Query', 'Path', 'Payload', 'Response'].reduce(function(current, part){
	current[part] = ZSchemaErrors.init({
		contextMessage: baseMessage.replace('{part}', part)
	});

	return current;
}, {});

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
			var report,
				parts = ['Path', 'Query', 'Headers', 'Payload'];

			for (var i = 0; i < parts.length; i++){
				report = routeSchemaManager['validate' + parts[i]](request);

				if (!report.valid){
					return next(plugin.hapi.error.badRequest(errorReporters[parts[i]].extractMessage(report)));
				}
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
					errorMessages = errorReporters['response'](report);

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