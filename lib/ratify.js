// Load modules

var RequestValidator = require('./RequestValidator.js'),
	SwaggerManager = require('./SwaggerManager.js'),
	Hoek = require('hoek'),
	defaults = {
		pluginName: 'ratify',
		auth: false,
		baseUrl: 'http://localhost',
		startingPath: '/api-docs',
		apiVersion: '',
		responseContentTypes: ['application/json'],
		docsCaching: true,
		log: function(){}
	};


module.exports.register = function (plugin, options, next) {

	var Hapi = plugin.hapi,
		settings = Hoek.applyToDefaults(defaults, options || {}),
		swaggerManager = new SwaggerManager(settings);

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


	RequestValidator(plugin, settings);

	next();
};

module.exports.register.attributes = {
	pkg: require('../package.json')
};