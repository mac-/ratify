var _ = require('underscore'),
	fs = require('fs');

var SwaggerManager = function(apiVersion, pluginName, responseContentTypes) {

 	var getRoutesGroupedByName = function(routes) {
			var filteredRoutes = _.filter(routes, function(route) {
				if (route.settings.plugins && route.settings.plugins[pluginName]) {
					return (route.settings.plugins[pluginName].swagger === undefined || route.settings.plugins[pluginName].swagger === true);
				}
				return false;
			});
			return _.groupBy(filteredRoutes, function(route) {
				return route.path.split('/')
								.filter(function(part){ return part.indexOf('{') !== 0; })
								.pop();
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
			var params = [];
			if (swaggerParamTypeMap[type] &&
				route.settings.plugins &&
				route.settings.plugins[pluginName] &&
				route.settings.plugins[pluginName][type]) {
				var schema = route.settings.plugins[pluginName][type];
				if (type === 'payload') {
					// keep an eye on https://github.com/wordnik/swagger-ui/issues/72
					// looks like there might be change as far as body params go
					if (route.settings.payload.allow.indexOf('application/json') >= 0) {
						var param = {
							paramType: swaggerParamTypeMap[type],
							name: 'body',
							description: schema.description,
							type: schema.type,
							required: true
						};
						params.push(param);
					}
					else {
						for (var prop in schema.properties) {
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
					for (var prop in schema.properties) {
						if (schema.properties.hasOwnProperty(prop)) {
							var param = {
								paramType: swaggerParamTypeMap[type],
								name: prop,
								description: schema.properties[prop].description,
								type: schema.properties[prop].type,
								required: (schema.required && schema.required.indexOf(prop) >= 0)
							};

							if (schema.properties[prop].minimum) {
								param.minimum = (schema.properties[prop].exclusiveMinimum) ? schema.properties[prop].minimum + 1 : schema.properties[prop].minimum;
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
			}

			return params;
		},

		getSwaggerOperationForRoute = function(route, resourceType) {
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
				route.settings.plugins[pluginName] &&
				(route.settings.plugins[pluginName]['payload'] ||
				(route.settings.plugins[pluginName]['response'] &&
				route.settings.plugins[pluginName]['response'].schema))) {
				schema = (route.settings.plugins[pluginName]['payload']) ? route.settings.plugins[pluginName]['payload'] : route.settings.plugins[pluginName]['response'].schema;

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

			return operation;
		},

		getResponseModelForRoute = function(route) {
			var model;
			if (route.settings.plugins &&
				route.settings.plugins[pluginName] &&
				route.settings.plugins[pluginName]['response'] &&
				route.settings.plugins[pluginName]['response'].schema) {
				model = _.clone(route.settings.plugins[pluginName]['response'].schema);

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
			apiVersion: apiVersion || getApplicationVersion().split('.')[0],
			swaggerVersion: '1.2',
			apis: []
		},
		defaultApiDeclaration = {
			apiVersion: apiVersion || getApplicationVersion().split('.')[0],
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
 			routesByPath = getRoutesGroupedByPath(routesByGroupNames[apiName]);
			apiObj = _.clone(defaultApiDeclaration);

		apiObj.apis = [];
		apiObj.basePath = _.map(routesByPath, function(routes) { return routes[0].server.info.uri; })[0];
		apiObj.resourcePath = '/' + apiName;
		apiObj.produces = responseContentTypes;
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
					api.operations.push(getSwaggerOperationForRoute(route, apiName));

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