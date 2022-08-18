var	RouteSchemaManager = require('./RouteSchemaManager');

var ZSchemaErrors = require('z-schema-errors');
var Hoek = require('hoek');
var Boom = require('boom');
var capitalize = require('capitalize');

var baseMessage = '{part} parameters validation error:';

var errorReporters = ['headers', 'query', 'path', 'payload', 'response'].reduce(function(current, part){
	current[part] = ZSchemaErrors.init({
		contextMessage: baseMessage.replace('{part}', capitalize(part))
	});

	return current;
}, {});

var RequestValidator = function(plugin, options) {
	options = options || {};

	let initializedRoutes = false;
	var configuredErrorReporters = Hoek.applyToDefaults(errorReporters, options.errorReporters || {});
	var routeSchemaManager = new RouteSchemaManager({ pluginName: options.pluginName, log: options.log }),
		log = options.log || function(){},

		onRequest = function(request, h) {
			try {
				if (!initializedRoutes) {
				  var table = request.server.table();
				  routeSchemaManager.initializeRoutes(table);
				  initializedRoutes = true;
				}
			}
			catch (error){
				log('error', 'Unable to compile and validate schemas', error);
				throw error;
			}

			return h.continue;
		},

		onPreHandler = function(request, h) {
			var report,
				parts = ['path', 'query', 'headers', 'payload'];

			for (var i = 0; i < parts.length; i++){
				var capitalizedParts = capitalize(parts[i]);
				report = routeSchemaManager['validate' + capitalizedParts](request);

				if (!report.valid){
					throw Boom.badRequest(configuredErrorReporters[parts[i]].extractMessage({ report: report, context: { request: request } }));
				}
			}

			return h.continue;
		},

		onPostHandler = function(request, h) {
			var report, errorMessages;

			// if route config contains a schema for the respose, and sample rate is greater than 0, validate it
			if (request.route.settings.plugins &&
				request.route.settings.plugins[options.pluginName] &&
				request.route.settings.plugins[options.pluginName].response &&
				request.route.settings.plugins[options.pluginName].response.schema &&
				request.route.settings.plugins[options.pluginName].response.sample !== 0 &&
				request.route.settings.plugins[options.pluginName].response.sample !== false) {

				// if sampling is enabled and the random sample value is greater than the defined sample rate, don't validate
				if (request.route.settings.plugins[options.pluginName].response.sample) {
					var currentSample = Math.ceil((Math.random() * 100));
					if (currentSample > request.route.settings.plugins[options.pluginName].response.sample) {
						return h.continue;
					}
				}

				if (request.response.isBoom) {
					return h.continue;
				}

				report = routeSchemaManager.validateResponse(request);
				if (!report.valid) {
					errorMessages = configuredErrorReporters['response'].extractMessage({ report: report, context: { request: request } });

					if (request.route.settings.plugins[options.pluginName].response.failAction === 'log') {
						request.log(['validation', 'error'], errorMessages);
						return h.continue;
					}
					throw Boom.internal(errorMessages);
				}
			}
			return h.continue;
		};

	// hook for compiling all schemas for all routes (one time)
	plugin.ext('onRequest', onRequest);
	// hook for validating request payload, query params, and path params
	plugin.ext('onPreHandler', onPreHandler);
	// hook for validating response payload
	plugin.ext('onPostHandler', onPostHandler);

};

module.exports = RequestValidator;
