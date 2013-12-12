var assert = require('assert'),
	RouteSchemaManager = require('../lib/RouteSchemaManager'),
	rsmConfig = {
		pluginName: 'ratify'
	},
	stringSchema = {
		type: 'string',
		minLength: 1
	},
	numberSchema = {
		type: 'number',
		minimum: 1
	},
	booleanSchema = {
		type: 'boolean'
	},
	objSchema = {
		type: 'object',
		properties: {
			string: stringSchema
		}
	},
	arraySchema = {
		type: 'array',
		items: stringSchema
	},
	mockRoute1 = {
		method: 'POST',
		path: '/fnord/{string}/{number}',
		server: {
			info: {
				uri: 'http://fnord.com'
			}
		},
		settings: {
			plugins: {
				ratify: {
					path: {
						type: 'object',
						properties: {
							string: stringSchema,
							number: numberSchema
						},
						required: ['string', 'number']
					},
					response: {
						schema: objSchema
					},
					payload: objSchema,
					query: {
						type: 'object',
						properties: {
							array: arraySchema,
							string: stringSchema,
							bool: booleanSchema
						}
					},
					headers: {
						type: 'object',
						properties: {
							string: stringSchema,
							'Number': numberSchema
						}
					}
				}
			}
		}
	},
	mockRoute2 = {
		method: 'POST',
		path: '/bad/fnord/{string}/{number}',
		server: {
			info: {
				uri: 'http://fnord.com'
			}
		},
		settings: {
			plugins: {
				ratify: {
					fake: objSchema,
				}
			}
		}
	},
	mockRoute3 = {
		method: 'POST',
		path: '/another/bad/fnord/{string}/{number}',
		server: {
			info: {
				uri: 'http://fnord.com'
			}
		},
		settings: {
			plugins: {
				ratify: {
					headers: 'invalid config',
				}
			}
		}
	},
	mockRoute4 = {
		method: 'POST',
		path: '/yet/another/bad/fnord/{string}/{number}',
		server: {
			info: {
				uri: 'http://fnord.com'
			}
		},
		settings: {
			plugins: {
				ratify: {
					headers: {
						type: 'fnord',
						items: 5
					},
				}
			}
		}
	},
	mockRoutes = [mockRoute1, mockRoute2, mockRoute3];

describe('RouteSchemaManager Unit Tests', function() {

	describe('validatePath', function() {
		it('should not compile the same routes more than once', function(done) {
			var routeSchemaManager = new RouteSchemaManager(rsmConfig);
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
					assert(!error, 'initialize should not return error');
					done();
				});
			});
		});

		it('should return an error if unable to compile routes', function(done) {
			var routeSchemaManager = new RouteSchemaManager(rsmConfig);
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, [mockRoute4], function(error) {
				assert(error, 'initialize should return error');
				done();
			});
		});
	});

	describe('validatePath', function() {
		it('should validate path params for route successfully', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				pathObj = {
					string: 'fnord',
					number: '12345'
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validatePath(mockRoute1, pathObj);
				assert(report.valid, 'path obj should be valid');
				done();
			});
		});

		it('should validate path params for route with no path schema successfully', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				pathObj = {
					string: 'fnord',
					number: '12345'
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validatePath(mockRoute2, pathObj);
				assert(report.valid, 'path obj should be valid');
				done();
			});
		});

		it('should fail validation of path params', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				pathObj = {
					string: true,
					number: []
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validatePath(mockRoute1, pathObj);
				assert(!report.valid, 'path obj should not be valid');
				assert(report.errors, 'errors obj should be valid');
				done();
			});
		});
	});

	describe('validateQuery', function() {
		it('should validate query params for route successfully', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				queryObj = {
					string: 'fnord',
					array: [
						'fnord1',
						'fnord2'
					]
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validateQuery(mockRoute1, queryObj);
				assert(report.valid, 'query obj should be valid');
				done();
			});
		});

		it('should validate query params for route with no query schema successfully', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				queryObj = {
					string: 'fnord',
					array: [
						'fnord1',
						'fnord2'
					]
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validateQuery(mockRoute2, queryObj);
				assert(report.valid, 'query obj should be valid');
				done();
			});
		});

		it('should validate query params successfully while converting properties to arrays if defined as such by schema', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				queryObj = {
					string: 'fnord',
					array: 'fnord1'
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validateQuery(mockRoute1, queryObj);
				assert(report.valid, 'query obj should be valid');
				done();
			});
		});

		it('should validate query params successfully while converting properties to arrays (from objects) if defined as such by schema', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				queryObj = {
					string: 'fnord',
					'array[0]': 'fnord1',
					'array[1]': 'fnord2'
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validateQuery(mockRoute1, queryObj);
				assert(report.valid, 'query obj should be valid');
				done();
			});
		});

		it('should validate query params successfully while converting properties to booleans (true) if defined as such by schema', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				queryObj = {
					string: 'fnord',
					bool: 'true'
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validateQuery(mockRoute1, queryObj);
				assert(report.valid, 'query obj should be valid');
				done();
			});
		});

		it('should validate query params successfully while converting properties to booleans (false) if defined as such by schema', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				queryObj = {
					string: 'fnord',
					bool: 'false'
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validateQuery(mockRoute1, queryObj);
				assert(report.valid, 'query obj should be valid');
				done();
			});
		});

		it('should not validate query params successfully while avoiding the conversion of properties to different types when the types cannot be coerced to the type defined in the schema', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				queryObj = {
					string: 'fnord',
					array: { fnord: 1 },
					bool: 'truefalse'
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validateQuery(mockRoute1, queryObj);
				assert(!report.valid, 'query obj should not be valid');
				done();
			});
		});

		it('should fail validation of query params', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				queryObj = {
					string: true
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validateQuery(mockRoute1, queryObj);
				assert(!report.valid, 'query obj should not be valid');
				assert(report.errors, 'errors obj should be valid');
				done();
			});
		});
	});

	describe('validatePayload', function() {
		it('should validate payload for route successfully', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				payload = {
					string: 'fnord'
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validatePayload(mockRoute1, payload);
				assert(report.valid, 'payload obj should be valid');
				done();
			});
		});

		it('should validate payload for route with no payload schema successfully', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				payload = {
					string: 'fnord'
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validatePayload(mockRoute2, payload);
				assert(report.valid, 'payload obj should be valid');
				done();
			});
		});

		it('should fail validation of payload', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				payload = {
					string: true
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validatePayload(mockRoute1, payload);
				assert(!report.valid, 'payload obj should not be valid');
				assert(report.errors, 'errors obj should be valid');
				done();
			});
		});
	});

	describe('validateHeaders', function() {
		it('should validate header params for route successfully', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				headerObj = {
					string: 'fnord',
					number: 1
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validateHeaders(mockRoute1, headerObj);
				assert(report.valid, 'header obj should be valid');
				done();
			});
		});

		it('should validate header params for route successfully while converting properties to types if defined by schema', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				headerObj = {
					string: 'fnord',
					number: '1'
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validateHeaders(mockRoute1, headerObj);
				assert(report.valid, 'header obj should be valid');
				done();
			});
		});

		it('should validate header params for route with no header schema successfully', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				headerObj = {
					string: 'fnord',
					number: 1
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validateHeaders(mockRoute2, headerObj);
				assert(report.valid, 'header obj should be valid');
				done();
			});
		});

		it('should fail validation of header params', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				headerObj = {
					string: true
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validateHeaders(mockRoute1, headerObj);
				assert(!report.valid, 'header obj should not be valid');
				assert(report.errors, 'errors obj should be valid');
				done();
			});
		});
	});

	describe('validateResponse', function() {
		it('should validate response for route successfully', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				response = {
					string: 'fnord'
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validateResponse(mockRoute1, response);
				assert(report.valid, 'response obj should be valid');
				done();
			});
		});

		it('should validate response for route with no response schema successfully', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				response = {
					string: 'fnord'
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validateResponse(mockRoute2, response);
				assert(report.valid, 'response obj should be valid');
				done();
			});
		});

		it('should fail validation of response', function(done) {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				response = {
					string: true
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes, function(error) {
				assert(!error, 'initialize should not return error');
				var report = routeSchemaManager.validateResponse(mockRoute1, response);
				assert(!report.valid, 'response obj should not be valid');
				assert(report.errors, 'errors obj should be valid');
				done();
			});
		});
	});
});