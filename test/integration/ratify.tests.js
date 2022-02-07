var assert = require('assert'),
	plugin = require('../../lib/ratify.js'),
	Hapi = require('hapi');

before(async function() {
	server = new Hapi.Server({ port: '8085', host: 'localhost', routes: { cors: true }});

	await server.register({
		plugin,
		options: { }
	});
	var get = function (request, h) {
		return { clientId: 'fnord', email: 'myemail@fake.com' };
	};

	server.route({
		method: 'GET',
		path: '/clients/{clientId}',
		handler: get,
		config: {
			plugins: {
				ratify: {
					headers: {
						type: 'object',
						properties: {
							authorization: {
								type: 'string',
								description: 'A valid access token issued for a given client for accessing protected resources'
							}
						}
					},
					path: {
						type: 'object',
						properties: {
							clientId: {
								type: 'string',
								minLength: 3,
								pattern: '^[\\w_0-9-]+$',
								description: 'A unique identifier for the client/user'
							}
						},
						required: ['clientId']
					},
					response: {
						sample: 100,
						failAction: 'log',
						schema: {
							type: 'object',
							properties: {
								clientId: {
									type: 'string',
									minLength: 3,
									pattern: '^[\\w_0-9-]+$',
									description: 'A unique identifier for the client/user'
								},
								email: {
									type: 'string',
									minLength: 3,
									pattern: '^.+@.+$',
									description: 'An email address associated to the client'
								},
								nestedObject: {
									type: 'object',
									properties: {
										nestedObject2: {
											type: 'object',
											properties: {
												id: {
													type: 'string',
													description: 'sample id field',
													defaultValue: '123'
												}
											}
										},
									}
                                }
							},
							required: ['clientId', 'email'],
							additionalProperties: false
						}
					}
				}
			}
		}
	});
	server.route({ method: 'GET', path: '/test/{param}', handler: get });

});



describe('ratify plugin tests', function() {

	it('should provide a swagger docs end point', async function() {

		const res = await server.inject('/api-docs');
		assert(res.statusCode === 200);
	});

	it('should provide a swagger docs end point to a resource', async function() {

		const res = await server.inject('/api-docs/clients')
		assert(res.statusCode === 200);
	});

	it('should generate correct models for deeply nested schema', function(done) {
		server.inject('/api-docs/clients', function (res) {
			assert(res.statusCode === 200);

			var parsedPayload = JSON.parse(res.payload)

			var nestedRef = parsedPayload.models.get_clients_by_clientId_response.properties.nestedObject.$ref;
			assert(nestedRef === 'get_clients_by_clientId_response_nestedObject');
			assert(parsedPayload.models[nestedRef].type === 'object');

			var nestedRef2 = parsedPayload.models[nestedRef].properties.nestedObject2.$ref;
			assert(nestedRef2 === 'get_clients_by_clientId_response_nestedObject2');
			assert(parsedPayload.models[nestedRef2].properties.id.description === 'sample id field');
			assert(parsedPayload.models[nestedRef2].properties.id.defaultValue === '123');

			done();
		});
	});

	it('should validate path, headers, and response body against schema', async function() {

		const res = await server.inject({
			url: '/clients/fnord',
			headers: {
				authorization: 'somekey'
			}
		})
		assert(res.statusCode === 200);
	});
});
