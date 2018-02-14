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
