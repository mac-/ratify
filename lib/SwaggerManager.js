var _ = require('lodash'),
	fs = require('fs');

var SwaggerManager = function(options) {

	options = options || {};

	var swaggerHooks = options.swaggerHooks || {};

	var apiDocsCache = {};

	var consumesDefaults = ['application/json', 'application/x-www-form-urlencoded'];

	var getRoutesGroupedByName = function(routes) {
			var filteredRoutes = _.filter(routes, function(route) {
				if (route.settings.plugins && route.settings.plugins[options.pluginName]) {
					return (route.settings.plugins[options.pluginName].swagger === undefined || route.settings.plugins[options.pluginName].swagger === true);
				}
				return false;
			});
			return _.groupBy(filteredRoutes, function(route) {
				if (swaggerHooks.routeNameGroup){
					return swaggerHooks.routeNameGroup(route);
				}
				var groupName = route.path;
				if (groupName.lastIndexOf('}') === groupName.length - 1) {
					groupName = groupName.substring(0, groupName.lastIndexOf('/'));
				}
				return groupName.substr(1).replace(/\{/g, '_').replace(/\}/g, '_');
			});
		},

		swaggerParamTypeMap = {
			path: 'path',
			query: 'query',
			payload: 'body',
			headers: 'header'
		},

		getRoutesGroupedByPath = function(routes) {
			return _.groupBy(routes, function(item) {
				return item.path;
			});
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

		getApplicationVersion = function() {
			var executingFile = process.argv[1];
			var packageLoc = findPackageJson(executingFile.replace(/\/[^\/]+?$/g, ''));

			if (packageLoc) {
				return require(packageLoc).version;
			}
			return 'unknown';
		},

		getSwaggerParams = function(route, type, operationNickname) {
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
							type: operationNickname ? operationNickname + '_body' : schema.type,
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
							if (schema.properties[prop].hasOwnProperty('items')) {
								param.items = schema.properties[prop].items;
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

		setOperationConsumes = function (payloadParameters, route, operation) {
			if (!payloadParameters.length) { //if no payload parameters, no consumes attribute
				return;
			}

			if (route.settings.payload && route.settings.payload.allow && route.settings.payload.parse) {
				operation.consumes = route.settings.payload.allow;
			} else {
				operation.consumes = consumesDefaults;
			}
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
					summary: route.settings.description,
					notes: route.settings.notes,
					tags: route.settings.tags,
					type: 'void',
					nickname: route.settings.plugins[options.pluginName].nickname || (route.method + '_' + nickname),
					parameters: []
				},
				schema,
				plugins = route.settings.plugins;



			if (plugins &&
				plugins[options.pluginName] &&
				plugins[options.pluginName].response){

				if (plugins[options.pluginName].response.schema){
					schema = plugins[options.pluginName].response.schema;

					if (schema.oneOf &&
						Array.isArray(schema.oneOf) &&
						schema.oneOf.length > 0) {
						schema = schema.oneOf[0];
					}

					if (schema.type === 'object') {
						operation.type = operation.nickname + '_response';
					}
					else if (schema.type === 'array') {
						operation.type = schema.type;
						operation.items = { '$ref': operation.nickname + '_response' };
					}
					else {
						operation.type = schema.type;
						operation.description = schema.description;
						operation.defaultValue = schema.defaultValue;
					}
				}

				if (plugins[options.pluginName].response.messages){
					operation.responseMessages = plugins[options.pluginName].response.messages;
				}
			}

			operation.parameters = operation.parameters.concat(getSwaggerParams(route, 'path'));

			operation.parameters = operation.parameters.concat(getSwaggerParams(route, 'query'));

			var payloadParameters = getSwaggerParams(route, 'payload', operation.nickname);
			operation.parameters = operation.parameters.concat(payloadParameters);

			operation.parameters = operation.parameters.concat(getSwaggerParams(route, 'headers'));

			setOperationConsumes(payloadParameters, route, operation);

			//TODO: warn if more than 1 param with the same name

			if (swaggerHooks.operation){
				swaggerHooks.operation(operation, route, resourceType, path);
			}

			return operation;
		},

		getModelForRoute = function(route, modelKind, modelGetter){
			var plugins = route.settings.plugins;
			var model;
			if (plugins && plugins[options.pluginName] &&
				plugins[options.pluginName][modelKind] && modelGetter()) {
				model = _.cloneDeep(modelGetter());

				if(model.oneOf && Array.isArray(model.oneOf) && model.oneOf.length > 0) {
					model = model.oneOf[0];
				}

				if (model.type === 'array') {
					model = _.cloneDeep(model.items);
				}
				else if (model.type !== 'object') {
					return null;
				}
			}

			return model;
		},

		getRequestModelForRoute = function(route){
			return getModelForRoute(route, 'payload', function(){
				return route.settings.plugins[options.pluginName].payload;
			});
		},

		getResponseModelForRoute = function(route) {
			return getModelForRoute(route, 'response', function(){
				return route.settings.plugins[options.pluginName].response.schema;
			});
		},

		generateNestedModels = function (model, models, prefix, parent){
			if (!model.properties){
				return;
			}

			parent = parent || '';

			Object.keys(model.properties).forEach(function(prop){
				if (model.properties[prop].properties ||
					model.properties[prop].oneOf ||
				 	model.properties[prop].type === 'object' ||
				 	(Array.isArray(model.properties[prop].type) &&
				 	model.properties[prop].type.indexOf('object') >= 0)){

					if (model.properties[prop].oneOf &&
						Array.isArray(model.properties[prop].oneOf) &&
						model.properties[prop].oneOf.length > 0) {
						// Replace the node with the first occurrence of the Array and go through this model again.
						model.properties[prop] = model.properties[prop].oneOf[0];
						return generateNestedModels(model, models, prefix, parent);
					}

					models[prefix + prop] = _.cloneDeep(model.properties[prop]);
					// models[prefix + prop] may be a nested object, we should regenerate nested model:
					generateNestedModels(models[prefix + prop], models, prefix, parent);
					generateNestedModels(model.properties[prop], models, prefix, parent + prop + '.');
					model.properties[prop] = { $ref: prefix + prop};
				}
			});
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
			resourceListingModel = _.cloneDeep(defaultResourceListingModel);

		resourceListingModel.apis = [];
		Object.keys(routesByGroupNames).forEach(function(item) {
			resourceListingModel.apis.push({ path: '/' + item });
		});

		return resourceListingModel;
	};

	this.getApiDeclarationModel = function(routes, apiName) {
		var cached = apiDocsCache[apiName];
		if (cached){
			return cached;
		}

		var routesByGroupNames = getRoutesGroupedByName(routes),
			routesByPath = getRoutesGroupedByPath(routesByGroupNames[apiName]),
			apiObj = _.cloneDeep(defaultApiDeclaration);

		apiObj.apis = [];
		apiObj.basePath = options.baseUrl;
		apiObj.resourcePath = '/' + apiName;
		apiObj.produces = options.responseContentTypes;

		apiObj.consumes = _.chain(routesByPath)
							.map(function(val) { return val; })
							.flatten()
							.map(function(route) {
								if (route.settings.payload && route.settings.payload.parse) {
									return (route.settings.payload.allow) ? route.settings.payload.allow : consumesDefaults;
								}
								return null;
							})
							.flatten()
							.uniq()
							.compact()
							.value();

		var models = {};

		for (var prop in routesByPath) {
			if (routesByPath.hasOwnProperty(prop)) {
				var api = {
					path: prop,
					operations: []
				};

				routesByPath[prop].forEach(function(route) {
					var operation = getSwaggerOperationForRoute(route, apiName, prop);
					api.operations.push(operation);

					var responseModel = getResponseModelForRoute(route);

					if (responseModel) {
						models[operation.nickname + '_response'] = responseModel;
						generateNestedModels(responseModel, models, operation.nickname + '_response_');
					}

					var requestModel = getRequestModelForRoute(route);

					if (requestModel) {
						models[operation.nickname + '_body'] = requestModel;
						generateNestedModels(requestModel, models, operation.nickname + '_body_');
					}
				});

				apiObj.apis.push(api);
			}
		}

		if (swaggerHooks.models){
			swaggerHooks.models(models);
		}

		apiObj.models = models;

		apiDocsCache[apiName] = apiObj;

		return apiObj;
	};

};

module.exports = SwaggerManager;
