var ZSchema = require('z-schema'),
	_ = require('lodash'),
	validator = new ZSchema();

var RouteSchemaManager = function(options) {
	options = options || {};

	var schemasByServerUri = {},
		validationTypes = {
			PATH: 'path',
			QUERY: 'query',
			PAYLOAD: 'payload',
			HEADERS: 'headers',
			RESPONSE: 'response'
		},

		constructSchemaKey = function(validationType, routeMethod, routePath) {
			return validationType + ':' + routeMethod + '|' + routePath;
		},

		isValidValidationProperty = function(name) {
			for (var prop in validationTypes) {
				if (validationTypes.hasOwnProperty(prop)) {
					if (validationTypes[prop] === name) {
						return true;
					}
				}
			}
			return false;
		},

		forEachValidationOption = function(route, iterator) {
			var validationOptions;
			if (route.settings.plugins && route.settings.plugins[options.pluginName]) {
				validationOptions = route.settings.plugins[options.pluginName];
				for (var prop in validationOptions) {
					if (validationOptions.hasOwnProperty(prop) && isValidValidationProperty(prop)) {
						iterator(validationOptions[prop], prop);
					}
				}
			}
		},

		// normalize all headers names in schema to lowercase
		modifyHeadersSchema = function(schema) {
			var modifiedSchema = {};

			for (var prop in schema) {
				if (schema.hasOwnProperty(prop)) {
					if (prop !== 'properties') {
						modifiedSchema[prop] = schema[prop];
					}
					else {
						modifiedSchema.properties = {};
						for (var subProp in schema.properties) {
							if (schema.properties.hasOwnProperty(subProp)) {
								modifiedSchema.properties[subProp.toLowerCase()] = modifyHeadersSchema(schema.properties[subProp]);
							}
						}
					}
				}
			}
			return modifiedSchema;
		},

		generateSchemasForRoute = function(route) {
			var schemas = {};
			forEachValidationOption(route, function(validationOption, validationType) {
				var validationSchema = (validationType === validationTypes.RESPONSE) ?
											validationOption.schema :
											(validationType === validationTypes.HEADERS) ?
												modifyHeadersSchema(validationOption) :
												validationOption;

				// don't validate file type payloads and void responses
				if (validationType === validationTypes.PAYLOAD && validationSchema.type === 'file' ||
					(validationType === validationTypes.RESPONSE && (!validationSchema || validationSchema.type === 'void'))) {
					return;
				}
				var schemaKey = constructSchemaKey(validationType, route.method, route.path);

				if (!validator.validateSchema(validationSchema)){
					throw new Error('Failed to validate schema for route: ' + route.path +
						', method: ' + route.method +
						', type: ' + validationType);
				}

				schemas[schemaKey] = validationSchema;
			});

			return schemas;
		},

		getSchemasForRoute = function(route) {
			var schemas = null,
				serverUri = route.server.info.uri;
			if (schemasByServerUri[serverUri]) {
				forEachValidationOption(route, function(validationOption, validationType) {
					schemas = schemas || {};
					var key = constructSchemaKey(validationType, route.method, route.path);
					schemas[validationType] = schemasByServerUri[serverUri][key];
				});
			}
			return schemas;
		},

		convertPropertyTypesToMatchSchema = function(object, schema, forceArrayConversion) {
			// in some cases (query params), we want to force a value to be an array that contains that value,
			// if the schema expects an array of strings, numbers, integers, or booleans
			if (forceArrayConversion && schema.type === 'array' && typeof(object) === 'string' && schema.items &&
				(schema.items.type === 'string' || schema.items.type === 'number' || schema.items.type === 'integer' || schema.items.type === 'boolean')) {
				object = [object];
			}
			var i, prop;
			if (schema.type === 'object' && typeof(object) === 'object' && schema.properties) {
				for (prop in schema.properties) {
					if (schema.properties.hasOwnProperty(prop) && object.hasOwnProperty(prop)) {
						object[prop] = convertPropertyTypesToMatchSchema(object[prop], schema.properties[prop], forceArrayConversion);
					}
				}
				return object;
			}
			else if (schema.type === 'array' && typeof(object) === 'object' && object instanceof Array && schema.items) {
				for (prop in schema.items) {
					if (schema.items.hasOwnProperty(prop)) {
						for (i = 0; i < object.length; i++) {
							object[i] = convertPropertyTypesToMatchSchema(object[i], schema.items, forceArrayConversion);
						}
					}
				}
				return object;
			}
			else {
				return convertValueFromStringToType(object, schema.type);
			}
		},

		convertValueFromStringToType = function(value, type) {
			if (typeof(value) !== 'string' || type === 'string') {
				return value;
			}
			if (type === 'integer' || type === 'number') {
				// fastest (and more reliable) way to convert strings to numbers
				var convertedVal = 1 * value;
				// make sure that if our schema calls for an integer, that there is no decimal
				if (convertedVal || convertedVal === 0 && (type === 'number' || (value.indexOf('.') === -1))) {
					return convertedVal;
				}
			}
			else if (type === 'boolean') {
				if (value === 'true') {
					return true;
				}
				else if (value === 'false') {
					return false;
				}
			}
			return value;
		},

		convertArraysInQueryString = function(queryObj) {
			var prop, newProp, idx,
				arraySyntaxRegex = /\[\d+\]$/;
			for (prop in queryObj) {
				if (queryObj.hasOwnProperty(prop)) {
					if (arraySyntaxRegex.test(prop)) {
						newProp = prop.substring(0, prop.lastIndexOf('['));
						queryObj[newProp] = queryObj[newProp] || [];
						idx = 1 * prop.substring(prop.lastIndexOf('[')+1, prop.lastIndexOf(']'));
						queryObj[newProp][idx] = queryObj[prop];
						delete queryObj[prop];
					}
				}
			}
		};

	this.initializeRoutes = function(serverUri, routes) {
		if (!schemasByServerUri[serverUri]) {
			schemasByServerUri[serverUri] = {};

			routes.forEach(function(route) {
				schemasByServerUri[serverUri] = _.extend(
					schemasByServerUri[serverUri],
					generateSchemasForRoute(route));
			});
		}
	};

	this.validatePath = function(request) {
		var schemas = getSchemasForRoute(request._route);
		if (!schemas || !schemas[validationTypes.PATH]) {
			return { valid: true };
		}
		// convert path types before validating
		convertPropertyTypesToMatchSchema(request.params, schemas[validationTypes.PATH]);

		var report = {
			valid: validator.validate(request.params, schemas[validationTypes.PATH])
		};

		if (!report.valid) {
			report.errors = validator.getLastErrors();
		}

		return report;
	};

	this.validateQuery = function(request) {
		var schemas = getSchemasForRoute(request._route);
		if (!schemas || !schemas[validationTypes.QUERY]) {
			return { valid: true };
		}
		// convert query types before validating
		convertArraysInQueryString(request.query);
		convertPropertyTypesToMatchSchema(request.query, schemas[validationTypes.QUERY], true);

		var report = {
			valid: validator.validate(request.query, schemas[validationTypes.QUERY])
		};
		if (!report.valid) {
			report.errors = validator.getLastErrors();
		}
		return report;
	};

	this.validatePayload = function(request) {
		var schemas = getSchemasForRoute(request._route);
		if (!schemas || !schemas[validationTypes.PAYLOAD]) {
			return { valid: true };
		}

		var headers = request.raw.req.headers;

		if (!headers['content-type'] && request.payload &&
					!(typeof request.payload === 'object' &&
						Object.keys(request.payload).length === 0)){
			return { valid: false, errors: ['unable to validate payload: missing content-type header and had content'] };
		}

		// convert payload types before validating only if payload is type application/x-www-form-urlencoded or multipart/form-data
		if (headers['content-type'] && (headers['content-type'].indexOf('application/x-www-form-urlencoded') === 0 || headers['content-type'].indexOf('multipart/form-data') === 0)) {
			convertPropertyTypesToMatchSchema(request.payload, schemas[validationTypes.PAYLOAD]);
		}

		var report = {
			valid: validator.validate(request.payload, schemas[validationTypes.PAYLOAD])
		};
		if (!report.valid) {
			report.errors = validator.getLastErrors();
		}
		return report;
	};

	this.validateHeaders = function(request) {
		var schemas = getSchemasForRoute(request._route);
		if (!schemas || !schemas[validationTypes.HEADERS]) {
			return { valid: true };
		}
		// convert header types before validating
		convertPropertyTypesToMatchSchema(request.raw.req.headers, schemas[validationTypes.HEADERS], true);

		var report = {
			valid: validator.validate(request.raw.req.headers, schemas[validationTypes.HEADERS])
		};
		if (!report.valid) {
			report.errors = validator.getLastErrors();
		}
		return report;
	};

	this.validateResponse = function(request) {
		var schemas = getSchemasForRoute(request._route);
		if (!schemas || !schemas[validationTypes.RESPONSE]) {
			return { valid: true };
		}

		var report = {
			valid: validator.validate(request.response.source, schemas[validationTypes.RESPONSE])
		};
		if (!report.valid) {
			report.errors = validator.getLastErrors();
		}
		return report;
	};
};

module.exports = RouteSchemaManager;