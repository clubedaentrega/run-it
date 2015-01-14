/*globals describe, it*/
'use strict'

var run = require('../')(),
	should = require('should'),
	domain = require('domain')

describe('basic usage', function () {
	it('should execute the target function in a domain', function (done) {
		domain._stack.should.have.length(0)
		run(function (success) {
			domain._stack.should.have.length(1)
			success()
		}, function (err) {
			should(err).be.null
			domain._stack.should.have.length(0)
			done()
		})
		domain._stack.should.have.length(0)
	})

	it('should preserve active domain in the final callback', function (done) {
		var d = domain.create()
		d.run(function () {
			run(function (success) {
				success()
			}, function () {
				process.domain.should.be.equal(d)
				d.exit()
				done()
			})
		})
	})

	it('should pass input values to target function', function (done) {
		run(function (in1, in2, in3, success) {
			in1.should.be.equal('in1')
			in2.should.be.equal('in2')
			in3.should.be.equal('in3')
			success()
		}, 'in1', 'in2', 'in3', done)
	})

	it('should pass output values to final callback', function (done) {
		run(function (success) {
			success('out1', 'out2', 'out3')
		}, function (err, out1, out2, out3) {
			should(err).be.null
			out1.should.equal('out1')
			out2.should.equal('out2')
			out3.should.equal('out3')
			done()
		})
	})

	it('should catch sync execption', function (done) {
		run(function () {
			throw new Error('Test error')
		}, function (err) {
			err.should.be.an.Error.and.have.property('message').equal('Test error')
			done()
		})
	})

	it('should catch async execption', function (done) {
		run(function () {
			setTimeout(function () {
				throw new Error('Test error')
			}, 10)
		}, function (err) {
			err.should.be.an.Error.and.have.property('message').equal('Test error')
			done()
		})
	})

	it('should call the final callback only once', function (done) {
		run(function (success) {
			success('a')
			success('b')
			success('c')
		}, function (err, char) {
			char.should.be.equal('a')
			done()
		})
	})

	it('should intercept async error', function (done) {
		run(function (success, error) {
			// Mimic a successful fs.readFile() call, for example
			setTimeout(error(function (value) {
				value.should.be.equal('value')

				// Mimic an async error
				setTimeout(error(function () {
					done(new Error('Should not get here'))
				}), 10, new Error('Async error'))
			}), 10, null, 'value')
		}, function (err) {
			err.message.should.be.equal('Async error')
			done()
		})
	})

	it('should error out with a message', function (done) {
		run(function (success, error) {
			error('Hey, an error!')
			done(new Error('Should not get here'))
		}, function (err) {
			err.message.should.be.equal('Hey, an error!')
			done()
		})
	})

	it('should accept placeholders for error message', function (done) {
		run(function (success, error) {
			error('A string %s, number %d, json %j', 's', 12, [false], 'hi')
		}, function (err) {
			err.message.should.be.equal('A string s, number 12, json [false] hi')
			done()
		})
	})

	it('should error out with an error instance', function (done) {
		run(function (success, error) {
			error(new Error('My error'))
			done(new Error('Should not get here'))
		}, function (err) {
			err.message.should.be.equal('My error')
			done()
		})
	})

	it('should accept error.orOut', function (done) {
		run(function (success, error) {
			// Success
			setTimeout(error.orOut('A1', 'A2'), 10, null)
		}, function (err, out1, out2) {
			should(err).be.null
			out1.should.be.equal('A1')
			out2.should.be.equal('A2')

			run(function (success, error) {
				// Error
				setTimeout(error.orOut('B1', 'B2'), 10, new Error('ER'))
			}, function (err, out1, out2) {
				err.message.should.be.equal('ER')
				should(out1).be.equal(undefined)
				should(out2).be.equal(undefined)
				done()
			})
		})
	})

	it('should accept error.orOutput', function (done) {
		run(function (success, error) {
			// Success
			setTimeout(error.orOutput(), 10, null, 'A1', 'A2')
		}, function (err, out1, out2) {
			should(err).be.null
			out1.should.be.equal('A1')
			out2.should.be.equal('A2')

			run(function (success, error) {
				// Success (trim)
				setTimeout(error.orOutput(1), 10, null, 'B1', 'B2')
			}, function (err, out1, out2) {
				should(err).be.null
				out1.should.be.equal('B1')
				should(out2).be.equal(undefined)

				run(function (success, error) {
					// Error
					setTimeout(error.orOutput(), 10, new Error('ER'))
				}, function (err, out1) {
					err.message.should.be.equal('ER')
					should(out1).be.equal(undefined)
					done()
				})
			})
		})
	})
})