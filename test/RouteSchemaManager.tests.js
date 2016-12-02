// headings were generated by http://patorjk.com/software/taag/#p=display&f=Colossal&t=ValidateResponse
var querystring = require('querystring');
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
	numberArraySchema = {
		type: 'array',
		items: numberSchema
	},
	objSchema = {
		type: 'object',
		properties: {
			string: stringSchema,
			numberArray: numberArraySchema
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
	mockRoute4 = {
		method: 'POST',
		path: '/good/fnord/{string}/{number}',
		server: {
			info: {
				uri: 'http://fnord.com'
			}
		},
		settings: {
			plugins: {
				ratify: {
					response: {
						schema: stringSchema
					}
				}
			}
		}
	},
	mockRoute5 = {
		method: 'POST',
		path: '/good/fnord',
		server: {
			info: {
				uri: 'http://fnord.com'
			}
		},
		settings: {
			plugins: {
				ratify: {
					payload: {
						type: 'file'
					}
				}
			}
		}
	},
	mockRoute6 = {
		method: 'POST',
		path: '/good/fnord/allow/empty/body',
		server: {
			info: {
				uri: 'http://fnord.com'
			}
		},
		settings: {
			plugins: {
				ratify: {
					payload: {
						type: [ 'object', 'null' ]
					}
				}
			}
		}
	},
	mockRoute7 = {
		method: 'POST',
		path: '/good/fnord',
		server: {
			info: {
				uri: 'http://fnord.com'
			}
		},
		settings: {
			plugins: {
				ratify: {
					payload: {
						type: 'file',
						properties: {
							users: {
								type: 'file'
							},
							numberArray: numberArraySchema
						}
					}
				}
			}
		}
	},
	mockRoutes = [mockRoute1, mockRoute2, mockRoute4];

describe('RouteSchemaManager Unit Tests', function() {

/*
	d8b          d8b 888    d8b          888 d8b                   8888888b.                   888                     
	Y8P          Y8P 888    Y8P          888 Y8P                   888   Y88b                  888                     
	                 888                 888                       888    888                  888                     
	888 88888b.  888 888888 888  8888b.  888 888 88888888  .d88b.  888   d88P .d88b.  888  888 888888 .d88b.  .d8888b  
	888 888 "88b 888 888    888     "88b 888 888    d88P  d8P  Y8b 8888888P" d88""88b 888  888 888   d8P  Y8b 88K      
	888 888  888 888 888    888 .d888888 888 888   d88P   88888888 888 T88b  888  888 888  888 888   88888888 "Y8888b. 
	888 888  888 888 Y88b.  888 888  888 888 888  d88P    Y8b.     888  T88b Y88..88P Y88b 888 Y88b. Y8b.          X88 
	888 888  888 888  "Y888 888 "Y888888 888 888 88888888  "Y8888  888   T88b "Y88P"   "Y88888  "Y888 "Y8888   88888P'
*/
	describe('initializeRoutes', function() {
		it('should not compile the same routes more than once', function() {
			var routeSchemaManager = new RouteSchemaManager(rsmConfig);
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			// if it gets here no errors were thrown
		});

		it('should return an error if unable to compile routes', function() {
			var routeSchemaManager = new RouteSchemaManager(rsmConfig);
			var error;
			try {
				routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, [mockRoute3]);
			}
			catch (er){
				error = er;
			}

			assert(error, 'initialize should return error');
		});
	});

/*
	                  888 d8b      888          888            8888888b.          888    888      
	                  888 Y8P      888          888            888   Y88b         888    888      
	                  888          888          888            888    888         888    888      
	888  888  8888b.  888 888  .d88888  8888b.  888888 .d88b.  888   d88P 8888b.  888888 88888b.  
	888  888     "88b 888 888 d88" 888     "88b 888   d8P  Y8b 8888888P"     "88b 888    888 "88b 
	Y88  88P .d888888 888 888 888  888 .d888888 888   88888888 888       .d888888 888    888  888 
	 Y8bd8P  888  888 888 888 Y88b 888 888  888 Y88b. Y8b.     888       888  888 Y88b.  888  888 
	  Y88P   "Y888888 888 888  "Y88888 "Y888888  "Y888 "Y8888  888       "Y888888  "Y888 888  888
*/
	describe('validatePath', function() {
		it('should validate path params for route successfully', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute1,
					params: {
						string: 'fnord',
						number: '12345'
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validatePath(mockRequest);
			assert(report.valid, 'path obj should be valid');
		});

		it('should validate path params for route with no path schema successfully', function() {
			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute2,
					params: {
						string: 'fnord',
						number: '12345'
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validatePath(mockRequest);
			assert(report.valid, 'path obj should be valid');
		});

		it('should fail validation of path params', function() {
			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute1,
					params: {
						string: true,
						number: []
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validatePath(mockRequest);
			assert(!report.valid, 'path obj should not be valid');
			assert(report.errors, 'errors obj should be valid');
		});
	});

/*
	                  888 d8b      888          888             .d88888b.                                     
	                  888 Y8P      888          888            d88P" "Y88b                                    
	                  888          888          888            888     888                                    
	888  888  8888b.  888 888  .d88888  8888b.  888888 .d88b.  888     888 888  888  .d88b.  888d888 888  888 
	888  888     "88b 888 888 d88" 888     "88b 888   d8P  Y8b 888     888 888  888 d8P  Y8b 888P"   888  888 
	Y88  88P .d888888 888 888 888  888 .d888888 888   88888888 888 Y8b 888 888  888 88888888 888     888  888 
	 Y8bd8P  888  888 888 888 Y88b 888 888  888 Y88b. Y8b.     Y88b.Y8b88P Y88b 888 Y8b.     888     Y88b 888 
	  Y88P   "Y888888 888 888  "Y88888 "Y888888  "Y888 "Y8888   "Y888888"   "Y88888  "Y8888  888      "Y88888 
	                                                                  Y8b                                 888 
	                                                                                                 Y8b d88P 
	                                                                                                  "Y88P"
*/
	describe('validateQuery', function() {
		it('should validate query params for route successfully', function() {
			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute1,
					query: {
						string: 'fnord',
						array: [
							'fnord1',
							'fnord2'
						]
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validateQuery(mockRequest);
			assert(report.valid, 'query obj should be valid');
		});

		it('should validate query params for route with no query schema successfully', function() {
			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				query = querystring.parse('string=fnord&array[0]=fnord1&array[1]=fnord2'),
				mockRequest = {
					_route: mockRoute2,
					query: query
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validateQuery(mockRequest);
			assert(report.valid, 'query obj should be valid');
		});

		it('should validate query params successfully while converting properties to arrays if defined as such by schema', function() {
			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				query = querystring.parse('string=fnord&array=fnord1'),
				mockRequest = {
					_route: mockRoute1,
					query: query
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validateQuery(mockRequest);
			assert(report.valid, 'query obj should be valid');
		});

		it('should validate query params successfully while converting properties to arrays (from objects) if defined as such by schema', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				query = querystring.parse('string=fnord&array[0]=fnord1&array[1]=fnord2'),
				mockRequest = {
					_route: mockRoute1,
					query: query
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validateQuery(mockRequest);
			assert(report.valid, 'query obj should be valid');
		});

		it('should validate query params successfully while converting properties to booleans (true) if defined as such by schema', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				query = querystring.parse('string=fnord&bool=true'),
				mockRequest = {
					_route: mockRoute1,
					query: query
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validateQuery(mockRequest);
			assert(report.valid, 'query obj should be valid');
		});

		it('should validate query params successfully while converting properties to booleans (false) if defined as such by schema', function() {
			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				query = querystring.parse('string=fnord&bool=false'),
				mockRequest = {
					_route: mockRoute1,
					query: query
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validateQuery(mockRequest);
			assert(report.valid, 'query obj should be valid');
		});

		it('should not validate query params successfully while avoiding the conversion of properties to different types when the types cannot be coerced to the type defined in the schema', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				query = querystring.parse('string=fnord&array[fnord]=1&bool=truefalse'),
				mockRequest = {
					_route: mockRoute1,
					query: query
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validateQuery(mockRequest);
			assert(!report.valid, 'query obj should not be valid');
		});

		it('should fail validation of query params if parsed object has incorrect type', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute1,
					query: {
						string: true
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validateQuery(mockRequest);
			assert(!report.valid, 'query obj should not be valid');
			assert(report.errors, 'errors obj should be valid');
		});

	});

/*
	                  888 d8b      888          888            8888888b.                   888                        888 
	                  888 Y8P      888          888            888   Y88b                  888                        888 
	                  888          888          888            888    888                  888                        888 
	888  888  8888b.  888 888  .d88888  8888b.  888888 .d88b.  888   d88P 8888b.  888  888 888  .d88b.   8888b.   .d88888 
	888  888     "88b 888 888 d88" 888     "88b 888   d8P  Y8b 8888888P"     "88b 888  888 888 d88""88b     "88b d88" 888 
	Y88  88P .d888888 888 888 888  888 .d888888 888   88888888 888       .d888888 888  888 888 888  888 .d888888 888  888 
	 Y8bd8P  888  888 888 888 Y88b 888 888  888 Y88b. Y8b.     888       888  888 Y88b 888 888 Y88..88P 888  888 Y88b 888 
	  Y88P   "Y888888 888 888  "Y88888 "Y888888  "Y888 "Y8888  888       "Y888888  "Y88888 888  "Y88P"  "Y888888  "Y88888 
	                                                                                   888                                
	                                                                              Y8b d88P                                
	                                                                               "Y88P"
*/
	describe('validatePayload', function() {
		it('should validate payload for route successfully', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute1,
					payload: {
						string: 'fnord'
					},
					raw: {
						req: {
							headers: {
								'content-type': 'application/json'
							}
						}
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validatePayload(mockRequest);
			assert(report.valid, 'payload obj should be valid');
		});

		it('should validate payload and convert types for route successfully for a form post', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute1,
					payload: {
						string: 'fnord',
						number: '1'
					},
					raw: {
						req: {
							headers: {
								'content-type': 'application/x-www-form-urlencoded'
							}
						}
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validatePayload(mockRequest);
			assert(report.valid, 'payload obj should be valid');
		});

		it('should validate payload for route successfully for a file upload', function() {
			var fs = require('fs');
			var data = fs.createReadStream('./test/jshint/config.json');
			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute5,
					payload: data,
					raw: {
						req: {
							headers: {
								'content-type': 'multipart/form-data'
							}
						}
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, [mockRoute5]);
			var report = routeSchemaManager.validatePayload(mockRequest);
			assert(report.valid, 'file payload should be valid');
		});

		it('should validate payload for route successfully for a file upload with extra data', function() {
			var fs = require('fs');
			var data = fs.createReadStream('./test/jshint/config.json');
			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute7,
					payload: {
						users: data,
						numberArray: ['5', '6']
					},
					raw: {
						req: {
							headers: {
								'content-type': 'multipart/form-data'
							}
						}
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, [mockRoute7]);
			var report = routeSchemaManager.validatePayload(mockRequest);
			assert(report.valid, 'file payload with extra data should be valid');
		});
		
		it('should validate payload for route with no payload schema successfully', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute2,
					payload: {
						string: 'fnord'
					},
					raw: {
						req: {
							headers: {
								'content-type': 'application/json'
							}
						}
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validatePayload(mockRequest);
			assert(report.valid, 'payload obj should be valid');
		});

		it('should fail validation of payload', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute1,
					payload: {
						string: true
					},
					raw: {
						req: {
							headers: {
								'content-type': 'application/json'
							}
						}
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validatePayload(mockRequest);
			assert(!report.valid, 'payload obj should not be valid');
			assert(report.errors, 'errors obj should be valid');
		});

		it('should fail validation of payload when no payload is present', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute1,
					payload: null,
					raw: {
						req: {
							headers: {
								'content-type': 'application/json'
							}
						}
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validatePayload(mockRequest);
			assert(!report.valid, 'payload obj should not be valid');
			assert(report.errors, 'errors obj should be valid');
		});

		it('should fail validation of payload when no content-type header present if there is content', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute1,
					payload: {
						string: 'fnord'
					},
					raw: {
						req: {
							headers: {}
						}
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validatePayload(mockRequest);
			assert(!report.valid, 'payload obj should not be valid');
			assert(report.errors, 'errors obj should be valid');
		});

		it('should pass validation of payload when no content-type header present if there is no content', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute6,
					raw: {
						req: {
							headers: {}
						}
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute6.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validatePayload(mockRequest);
			assert(report.valid, 'payload obj should be valid');
		});
	});

/*
	                  888 d8b      888          888            888    888                        888                           
	                  888 Y8P      888          888            888    888                        888                           
	                  888          888          888            888    888                        888                           
	888  888  8888b.  888 888  .d88888  8888b.  888888 .d88b.  8888888888  .d88b.   8888b.   .d88888  .d88b.  888d888 .d8888b  
	888  888     "88b 888 888 d88" 888     "88b 888   d8P  Y8b 888    888 d8P  Y8b     "88b d88" 888 d8P  Y8b 888P"   88K      
	Y88  88P .d888888 888 888 888  888 .d888888 888   88888888 888    888 88888888 .d888888 888  888 88888888 888     "Y8888b. 
	 Y8bd8P  888  888 888 888 Y88b 888 888  888 Y88b. Y8b.     888    888 Y8b.     888  888 Y88b 888 Y8b.     888          X88 
	  Y88P   "Y888888 888 888  "Y88888 "Y888888  "Y888 "Y8888  888    888  "Y8888  "Y888888  "Y88888  "Y8888  888      88888P' 
*/
	describe('validateHeaders', function() {
		it('should validate header params for route successfully', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute1,
					raw: {
						req: {
							headers: {
								string: 'fnord',
								number: 1
							}
						}
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validateHeaders(mockRequest);
			assert(report.valid, 'header obj should be valid');
		});

		it('should validate header params for route successfully while converting properties to types if defined by schema', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute1,
					raw: {
						req: {
							headers: {
								string: 'fnord',
								number: '1'
							}
						}
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validateHeaders(mockRequest);
			assert(report.valid, 'header obj should be valid');
		});

		it('should validate header params for route with no header schema successfully', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute2,
					raw: {
						req: {
							headers: {
								string: 'fnord',
								number: 1
							}
						}
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validateHeaders(mockRequest);
			assert(report.valid, 'header obj should be valid');
		});

		it('should fail validation of header params', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute1,
					raw: {
						req: {
							headers: {
								string: true
							}
						}
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validateHeaders(mockRequest);
			assert(!report.valid, 'header obj should not be valid');
			assert(report.errors, 'errors obj should be valid');
		});
	});

/*
	                  888 d8b      888          888            8888888b.                                                                
	                  888 Y8P      888          888            888   Y88b                                                               
	                  888          888          888            888    888                                                               
	888  888  8888b.  888 888  .d88888  8888b.  888888 .d88b.  888   d88P .d88b.  .d8888b  88888b.   .d88b.  88888b.  .d8888b   .d88b.  
	888  888     "88b 888 888 d88" 888     "88b 888   d8P  Y8b 8888888P" d8P  Y8b 88K      888 "88b d88""88b 888 "88b 88K      d8P  Y8b 
	Y88  88P .d888888 888 888 888  888 .d888888 888   88888888 888 T88b  88888888 "Y8888b. 888  888 888  888 888  888 "Y8888b. 88888888 
	 Y8bd8P  888  888 888 888 Y88b 888 888  888 Y88b. Y8b.     888  T88b Y8b.          X88 888 d88P Y88..88P 888  888      X88 Y8b.     
	  Y88P   "Y888888 888 888  "Y88888 "Y888888  "Y888 "Y8888  888   T88b "Y8888   88888P' 88888P"   "Y88P"  888  888  88888P'  "Y8888  
	                                                                                       888                                          
	                                                                                       888                                          
	                                                                                       888
*/
	describe('validateResponse', function() {
		it('should validate response for route successfully', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute1,
					response: {
						source: {string:'fnord'}
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validateResponse(mockRequest);
			assert(report.valid, 'response obj should be valid');
		});

		it('should validate a string response for route successfully', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute4,
					response: {
						source: 'fnord'
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validateResponse(mockRequest);
			assert(report.valid, 'response string should be valid');
		});

		it('should validate response for route with no response schema successfully', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute2,
					response: {
						source: {string:'fnord'}
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validateResponse(mockRequest);
			assert(report.valid, 'response obj should be valid');
		});

		it('should fail validation of response', function() {

			var routeSchemaManager = new RouteSchemaManager(rsmConfig),
				mockRequest = {
					_route: mockRoute1,
					response: {
						source: {string:true}
					}
				};
			routeSchemaManager.initializeRoutes(mockRoute1.server.info.uri, mockRoutes);
			var report = routeSchemaManager.validateResponse(mockRequest);
			assert(!report.valid, 'response obj should not be valid');
			assert(report.errors, 'errors obj should be valid');
		});

	});
});
