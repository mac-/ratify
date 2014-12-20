var _ = require('underscore'),
	fs = require('fs');

var SwaggerManager = function(options) {

	options = options || {};

	var swaggerHooks = options.swaggerHooks || {};

	var getRoutesGroupedByName = function(routes) {
			var filteredRoutes = _.filter(routes, function(route) {
				if (route.settings.plugins && route.settings.plugins[options.pluginName]) {
					return (route.settings.plugins[options.pluginName].swagger === undefined || route.settings.plugins[options.pluginName].swagger === true);
				}
				return false;
			});
			return _.groupBy(filteredRoutes, function(route) {
				var groupName = route.path;
				if (groupName.lastIndexOf('}') === groupName.length - 1) {
					groupName = groupName.substring(0, groupName.lastIndexOf('/'));
				}
				return groupName.substr(1).replace(/\{/g, '_').replace(/\}/g, '_');
			});
		},

		getRoutesGroupedByPath = function(routes) {
			return _.groupBy(routes, function(item) {
				return item.path;
			});
		},

		getApplicationVersion = function() {
			var executingFile = process.argv[1];
			var packageLoc = findPackageJson(executingFile.replace(/\/[^\/]+?$/g, ''));

			if (packageLoc) {
				return require(packageLoc).version;
			}
			return 'unknown';
		},

		findPackageJson = function(startingDirectory) {
			if (!startingDirectory) {
				return false;
			}
			if (fs.existsSync(startingDirectory + '/package.json')) {
				return startingDirectory + '/package.json';
			}
			return findPackageJson(startingDirectory.replace(/\/[^\/]+?$/g, ''));
		},

		getSwaggerParams = function(route, type) {
			var params = [], prop, param;
			if (swaggerParamTypeMap[type] &&
				route.settings.plugins &&
				route.settings.plugins[options.pluginName] &&
				route.settings.plugins[options.pluginName][type]) {
				var schema = route.settings.plugins[options.pluginName][type];

				if (type === 'payload') {
					// keep an eye on https://github.com/wordnik/swagger-ui/issues/72
					// looks like there might be change as far as body params go

					if (!route.settings.payload || !route.settings.payload.allow || route.settings.payload.allow.indexOf('application/json') >= 0) {
						param = {
							paramType: swaggerParamTypeMap[type],
							name: 'body',
							description: schema.description,
							type: schema.type,
							required: true
						};
						params.push(param);
					}
					else {
						for (prop in schema.properties) {
							if (schema.properties.hasOwnProperty(prop)) {
								var formParam = {
									paramType: 'form',
									name: prop,
									description: schema.properties[prop].description,
									type: schema.properties[prop].type,
									required: (schema.required && schema.required.indexOf(prop) >= 0)
								};
								params.push(formParam);
							}
						}
					}
					
				}
				else {
					for (prop in schema.properties) {
						if (schema.properties.hasOwnProperty(prop)) {
							param = {
								paramType: swaggerParamTypeMap[type],
								name: prop,
								description: schema.properties[prop].description,
								type: schema.properties[prop].type,
								required: (schema.required && schema.required.indexOf(prop) >= 0)
							};
							if (schema.properties[prop].hasOwnProperty('minimum')) {
								param.minimum = (schema.properties[prop].exclusiveMinimum) ? schema.properties[prop].minimum + 1 : schema.properties[prop].minimum;
							}
							if (schema.properties[prop].hasOwnProperty('maximum')) {
								param.maximum = schema.properties[prop].maximum;
							}
							if (schema.properties[prop].hasOwnProperty('enum')) {
								param.enum = schema.properties[prop].enum;
							}
							params.push(param);
						}
					}
				}
			}

			if (swaggerHooks.params){
				swaggerHooks.params(params, route, type);
			}

			return params;
		},

		getSwaggerOperationForRoute = function(route, resourceType, path) {
			var pathParts = path.split('/'),
				regex = /^\{.+\}$/,
				lastPart = pathParts.pop(),
				resourceId = (regex.test(lastPart)) ? lastPart : null,
				resourceName = (!resourceId) ? lastPart : pathParts.pop(),
				nickname = (!resourceId) ? resourceName : resourceName + '_by_' + resourceId.replace(/[\{\}]*/g, ''),
				operation = {
					method: route.method,
					summary: route.description,
					notes: route.notes,
					type: 'void',
					nickname: route.method + '_' + nickname,
					parameters: []
				},
				schema;

			if (route.settings.plugins &&
				route.settings.plugins[options.pluginName] &&
				(route.settings.plugins[options.pluginName]['payload'] ||
				(route.settings.plugins[options.pluginName]['response'] &&
				route.settings.plugins[options.pluginName]['response'].schema))) {
				schema = (route.settings.plugins[options.pluginName]['payload']) ? route.settings.plugins[options.pluginName]['payload'] : route.settings.plugins[options.pluginName]['response'].schema;

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

			operation.parameters = operation.parameters.concat(getSwaggerParams(route, 'path'));

			operation.parameters = operation.parameters.concat(getSwaggerParams(route, 'query'));

			operation.parameters = operation.parameters.concat(getSwaggerParams(route, 'payload'));

			operation.parameters = operation.parameters.concat(getSwaggerParams(route, 'headers'));

			//TODO: warn if more than 1 param with the same name

			if (swaggerHooks.operation){
				swaggerHooks.operation(operation, route, resourceType, path);
			}

			return operation;
		},

		getResponseModelForRoute = function(route) {
			var model;
			if (route.settings.plugins &&
				route.settings.plugins[options.pluginName] &&
				route.settings.plugins[options.pluginName]['response'] &&
				route.settings.plugins[options.pluginName]['response'].schema) {
				model = _.clone(route.settings.plugins[options.pluginName]['response'].schema);

				if (model.type === 'array') {
					model = model.items;
				}
				else if (model.type !== 'object') {
					return null;
				}
			}

			return model;
		},

		swaggerParamTypeMap = {
			path: 'path',
			query: 'query',
			payload: 'body',
			headers: 'header'
		},
		defaultResourceListingModel = {
			apiVersion: options.apiVersion || getApplicationVersion().split('.')[0],
			swaggerVersion: '1.2',
			apis: []
		},
		defaultApiDeclaration = {
			apiVersion: options.apiVersion || getApplicationVersion().split('.')[0],
			swaggerVersion: '1.2',
			basePath: '',
			resourcePath: '',
			produces: null,
			apis: null
		};

	this.isValidApi = function(routes, apiName) {
		var routesByGroupNames = getRoutesGroupedByName(routes);
		return routesByGroupNames.hasOwnProperty(apiName);
	};

	this.getResourceListingModel = function(routes) {
		var routesByGroupNames = getRoutesGroupedByName(routes),
			resourceListingModel = _.clone(defaultResourceListingModel);

		resourceListingModel.apis = [];
		Object.keys(routesByGroupNames).forEach(function(item) {
			resourceListingModel.apis.push({ path: '/' + item });
		});

		return resourceListingModel;
	};

	this.getApiDeclarationModel = function(routes, apiName) {

		var routesByGroupNames = getRoutesGroupedByName(routes),
			routesByPath = getRoutesGroupedByPath(routesByGroupNames[apiName]),
			apiObj = _.clone(defaultApiDeclaration);

		apiObj.apis = [];
		apiObj.basePath = options.baseUrl;
		apiObj.resourcePath = '/' + apiName;
		apiObj.produces = options.responseContentTypes;
		apiObj.consumes = _.chain(routesByPath)
							.map(function(val) { return val; })
							.flatten()
							.map(function(route) {
								var defaults = ['application/json', 'application/x-www-form-urlencoded'];
								if (route.settings.payload && route.settings.payload.parse) {
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
					api.operations.push(getSwaggerOperationForRoute(route, apiName, prop));

					var model = getResponseModelForRoute(route);
					if (model) {
						models[apiName] = model;
					}
				});
				apiObj.apis.push(api);
				apiObj.models = models;
			}
		}
		return apiObj;
	};

};

module.exports = SwaggerManager;