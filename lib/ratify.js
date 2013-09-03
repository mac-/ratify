// Load modules

var zSchema = require('z-schema'),
	async = require('async'),
	_ = require('underscore'),
	fs = require('fs'),
	Hapi,
	validator = new zSchema();


// Declare internals
var internals = {
	name: require('../package.json').name,
	version: require('../package.json').version,
	compiledSchemasByServerUri: {},
	requestValidationTypeMap: {
		path: 'params',
		query: 'query',
		payload: 'payload'
	},
	swaggerParamTypeMap: {
		path: 'path',
		query: 'query',
		payload: 'body'
	},
	defaults: {
		auth: false,
		startingPath: '/api-docs',
		apiVersion: '',
		responseContentTypes: ['application/json']
	}
};


internals.validate = function(serverUri, validationType, method, path, objectToValidate) {
	var key = internals.constructKey(validationType, method, path);
	var compiledSchema;
	if (internals.compiledSchemasByServerUri[serverUri]) {
		compiledSchema = internals.compiledSchemasByServerUri[serverUri][key];
	}

	// null, undefined, true - anything allowed
	// false, {} - nothing allowed
	// {...} - ... allowed
	if (compiledSchema === null || compiledSchema === undefined || compiledSchema === true) {
		return { valid: true };
	}
	return validator.validateWithCompiled(objectToValidate, compiledSchema);

};

internals.constructKey = function(validationType, routeMethod, routePath) {
	return validationType + ':' + routeMethod + '|' + routePath;
};

internals.onRequest = function(request, next) {
	var serverUri = request.server.info.uri;

	if (!internals.compiledSchemasByServerUri[serverUri]) {
		internals.compiledSchemasByServerUri[serverUri] = {};
		var routes = request.server.routingTable();
		var compileFuncs = {};

		routes.forEach(function(route) {
			var validationOptions;
			if (route.settings.plugins) {
				validationOptions = route.settings.plugins[internals.name];
			}
			if (validationOptions) {
				for (var prop in validationOptions) {
					if (validationOptions.hasOwnProperty(prop)) {
						var validationSchema = (prop === 'response') ? validationOptions[prop].schema : validationOptions[prop];
						(function(key, schema) {
							compileFuncs[key] = function(callback) {
								validator.compileSchema(schema, callback);
							};
						}(internals.constructKey(prop, route.method, route.path), validationSchema));
					}
				}
			}
		});

		async.parallel(compileFuncs, function(err, result) {
			if (err) {
				// log?
				return next(err);
			}
			internals.compiledSchemasByServerUri[serverUri] = result;
			next();
		});
	}
	else {
		next();
	}
};

internals.onPreHandler = function(request, next) {

	var objToValidate, report, prop, errorMessages, serverUri = request.server.info.uri;

	for (prop in internals.requestValidationTypeMap) {
		// if route config contains a schema for the given type, validate it
		if (request.route.plugins &&
			request.route.plugins[internals.name] &&
			request.route.plugins[internals.name][prop]) {
			
			objToValidate = request[internals.requestValidationTypeMap[prop]];
			report = internals.validate(serverUri, prop, request.method, request._route.path, objToValidate);
			if (!report.valid) {
				errorMessages = prop + ' parameters validation error: ' +
								_.map(report.errors, function(error) { return error.message; }).join(', ');
				break;
			}
		}
	}
	
	next(errorMessages ? Hapi.error.badRequest(errorMessages) : null);
};

internals.onPostHandler = function(request, next) {

	var report, errorMessages, serverUri = request.server.info.uri;

	// if route config contains a schema for the respose, and sample rate is greater than 0, validate it
	if (request.route.plugins &&
		request.route.plugins[internals.name] &&
		request.route.plugins[internals.name].response &&
		request.route.plugins[internals.name].response.schema &&
		request.route.plugins[internals.name].response.sample !== 0 &&
		request.route.plugins[internals.name].response.sample !== false) {

		// if sampling is enabled and the random sample value is greater than the defined sample rate, don't validate
		if (request.route.plugins[internals.name].response.sample) {
			var currentSample = Math.ceil((Math.random() * 100));
			if (currentSample > request.route.plugins[internals.name].response.sample) {
				return next();
			}
		}

		if (request._response.isBoom || request._response.varieties.error) {
			return next();
		}

		if (!request._response.varieties.obj) {
			return next(Hapi.error.internal('Cannot validate non-object response'));
		}
		
		report = internals.validate(serverUri, 'response', request.method, request._route.path, request._response.raw);
		if (!report.valid) {
			errorMessages = 'response body validation error: ' +
							_.map(report.errors, function(error) { return error.message; }).join(', ');

			if (request.route.plugins[internals.name].response.failAction === 'log') {
				request.log(['validation', 'error'], errorMessages);
				return next();
			}

			return next(Hapi.error.internal(errorMessages));
		}
	}
	next();
};

internals.resourceListingModel = {
	apiVersion: '',
	swaggerVersion: '1.2',
	apis: []
};

internals.apiDeclaration = {
	apiVersion: '',
	swaggerVersion: '1.2',
	basePath: '',
	resourcePath: '',
	produces: null,
	apis: null
};

internals.getRoutesGroupedByName = function(routes) {
	var filteredRoutes = _.filter(routes, function(route) {
		if (route.settings.plugins && route.settings.plugins[internals.name]) {
			return (route.settings.plugins[internals.name].swagger === undefined || route.settings.plugins[internals.name].swagger === true);
		}
		return false;
	});
	return _.groupBy(filteredRoutes, function(route) {
		return route.path.split('/')
						.filter(function(part){ return part.indexOf('{') !== 0; })
						.pop();
	});
};

internals.getRoutesGroupedByPath = function(routes) {
	return _.groupBy(routes, function(item) {
		return item.path;
	});
};

module.exports.name = internals.name;
module.exports.version = internals.version;


internals.getApplicationVersion = function() {
	var executingFile = process.argv[1];
	var packageLoc = internals.findPackageJson(executingFile.replace(/\/[^\/]+?$/g, ''));

	if (packageLoc) {
		return require(packageLoc).version;
	}
	return 'unknown';
};

internals.findPackageJson = function(startingDirectory) {
	if (!startingDirectory) {
		return false;
	}
	if (fs.existsSync(startingDirectory + '/package.json')) {
		return startingDirectory + '/package.json';
	}
	return internals.findPackageJson(startingDirectory.replace(/\/[^\/]+?$/g, ''));
};


internals.getSwaggerParams = function(route, type) {
	var params = [];
	if (internals.swaggerParamTypeMap[type] &&
		route.settings.plugins &&
		route.settings.plugins[internals.name] &&
		route.settings.plugins[internals.name][type]) {
		var schema = route.settings.plugins[internals.name][type];
		for (var prop in schema.properties) {
			if (schema.properties.hasOwnProperty(prop)) {
				var param = {
					paramType: internals.swaggerParamTypeMap[type],
					name: prop,
					description: schema.properties[prop].description,
					type: schema.properties[prop].type,
					required: (schema.required && schema.required.indexOf(prop) >= 0)
				};

				if (schema.properties[prop].minimum) {
					param.minimum = (schema.properties[prop].exclusinveMinimum) ? schema.properties[prop].minimum + 1 : schema.properties[prop].minimum;
				}
				if (schema.properties[prop].maximum) {
					param.maximum = schema.properties[prop].maximum;
				}
				if (schema.properties[prop].enum) {
					param.enum = schema.properties[prop].enum;
				}
				params.push(param);
			}
		}
	}

	return params;
};


internals.getSwaggerOperationForRoute = function(route, resourceType) {
	var operation = {
			method: route.method,
			summary: route.description,
			notes: route.notes,
			type: 'void',
			nickname: '',
			parameters: []
		};

	var schema;
	
	if (route.settings.plugins &&
		route.settings.plugins[internals.name] &&
		route.settings.plugins[internals.name]['response'] &&
		route.settings.plugins[internals.name]['response'].schema) {
		schema = route.settings.plugins[internals.name]['response'].schema;

		if (schema.type === 'object') {
			operation.type = resourceType;
		}
		else if (schema.type === 'array') {
			operation.type = schema.type;
			operation.items = { '$ref': resourceType };
		}
		else {
			operation.type = schema.type;
		}
	}

	operation.parameters = operation.parameters.concat(internals.getSwaggerParams(route, 'path'));

	operation.parameters = operation.parameters.concat(internals.getSwaggerParams(route, 'query'));

	operation.parameters = operation.parameters.concat(internals.getSwaggerParams(route, 'payload'));

	//TODO: add request headers
	
	//TODO: warn if more than 1 param with the same name

	return operation;
};

internals.getResponseModelForRoute = function(route) {
	var model;
	if (route.settings.plugins &&
		route.settings.plugins[internals.name] &&
		route.settings.plugins[internals.name]['response'] &&
		route.settings.plugins[internals.name]['response'].schema) {
		model = _.clone(route.settings.plugins[internals.name]['response'].schema);

		if (model.type === 'array') {
			model = model.items;
		}
		else if (model.type !== 'object') {
			return null;
		}
	}

	return model;
};


module.exports.register = function (plugin, options, next) {

	Hapi = plugin.hapi;
	var settings = plugin.hapi.utils.applyToDefaults(internals.defaults, options || {});
	internals.resourceListingModel.apiVersion = settings.apiVersion || internals.getApplicationVersion().split('.')[0];

	plugin.route({
		method: 'GET',
		path: settings.startingPath + '/{path*}',
		config: {
			handler: function(request, reply) {
				var routes = request.server.routingTable();
				routes = routes.filter(function (item) {
					return (request._route.path !== item.path && item.method !== 'options');
				});

				var routesByGroupNames = internals.getRoutesGroupedByName(routes);

				if (!request.params.path) {
					internals.resourceListingModel.apis = [];
					Object.keys(routesByGroupNames).forEach(function(item) {
						internals.resourceListingModel.apis.push({ path: '/' + item });
					});

					reply(internals.resourceListingModel);
				}
				else if (request.params.path && routesByGroupNames.hasOwnProperty(request.params.path)) {
					
					var routesByPath = internals.getRoutesGroupedByPath(routesByGroupNames[request.params.path]);
					var apiObj = _.clone(internals.apiDeclaration);
					apiObj.apis = [];
					apiObj.apiVersion = internals.resourceListingModel.apiVersion;
					apiObj.basePath = request.server.info.uri;
					apiObj.resourcePath = '/' + request.params.path;
					apiObj.produces = settings.responseContentTypes;
					apiObj.consumes = _.chain(routesByPath)
										.map(function(val) { return val; })
										.flatten()
										.map(function(route) {
											var defaults = ['application/json', 'application/x-www-form-urlencoded'];
											if (route.settings.payload.mode === 'parse') {
												return (route.settings.payload.allow) ? route.settings.payload.allow : defaults;
											}
											return null;
										})
										.flatten()
										.uniq()
										.compact()
										.value();
					
					for (var prop in routesByPath) {
						if (routesByPath.hasOwnProperty(prop)) {
							var api = {
								path: prop,
								operations: []
							};
							var models = {};
							routesByPath[prop].forEach(function(route) {
								api.operations.push(internals.getSwaggerOperationForRoute(route, request.params.path));

								var model = internals.getResponseModelForRoute(route);
								if (model) {
									models[request.params.path] = model;
								}
							});
							apiObj.apis.push(api);
							apiObj.models = models;
						}
					}
					reply(apiObj);
				}
				else {
					reply(Hapi.error.notFound());
				}
			}
		}
	});


	// hook for compiling all schemas for all routes (one time)
	plugin.ext('onRequest', internals.onRequest);
	// hook for validating request payload, query params, and path params
	plugin.ext('onPreHandler', internals.onPreHandler);
	// hook for validating response payload
	plugin.ext('onPostHandler', internals.onPostHandler);

	next();
};
