// Load modules

var RequestValidator = require('./RequestValidator.js'),
	SwaggerManager = require('./SwaggerManager.js'),
	Hoek = require('hoek'),
	name = require('../package.json').name,
	version = require('../package.json').version,
	defaults = {
		auth: false,
		startingPath: '/api-docs',
		apiVersion: '',
		responseContentTypes: ['application/json']
	};



module.exports.name = name;

module.exports.version = version;

module.exports.register = function (plugin, options, next) {

	var Hapi = plugin.hapi,
		settings = Hoek.applyToDefaults(defaults, options || {}),
		swaggerManager = new SwaggerManager(settings.apiVersion, name, settings.responseContentTypes);

	plugin.route({
		method: 'GET',
		path: settings.startingPath + '/{path*}',
		config: {
			auth: settings.auth,
			handler: function(request, reply) {
				var routes = request.server.table();
				routes = routes.filter(function (item) {
					return (request._route.path !== item.path && item.method !== 'options');
				});

				if (!request.params.path) {
					reply(swaggerManager.getResourceListingModel(routes));
				}
				else if (request.params.path && swaggerManager.isValidApi(routes, request.params.path)) {
					reply(swaggerManager.getApiDeclarationModel(routes, request.params.path));
				}
				else {
					reply(Hapi.error.notFound());
				}
			}
		}
	});


	RequestValidator(plugin, name);

	next();
};
