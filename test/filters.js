/*globals describe, it*/
'use strict'

var run = require('../')(),
	domain = require('domain'),
	should = require('should')

describe('filters', function () {
	it('should execute each filter in sequence', function (done) {
		var order = 0

		function f1(success) {
			order.should.be.equal(0)
			order = 1
			success()
		}

		function f2(success) {
			order.should.be.equal(1)
			order = 2
			success()
		}

		function fn(success) {
			order.should.be.equal(2)
			order = 3
			success()
		}

		run([[f1, f2], fn], function (err) {
			should(err).be.null()
			order.should.be.equal(3)
			order = 4
			done(err)
		})
	})

	it('should accept old spread syntax', function (done) {
		function f1(success) {
			success()
		}

		function f2(success) {
			success()
		}

		function fn(success) {
			success()
		}

		run([f1, f2, fn], done)
	})

	it('should execute each filter in a different domain', function (done) {
		var d = domain.create()
		d.run(function () {
			var d1, d2, dn

			function f1(success) {
				d1 = process.domain
				success()
			}

			function f2(success) {
				d2 = process.domain
				d2.should.not.be.equal(d1)
				success()
			}

			function fn(success) {
				dn = process.domain
				dn.should.not.be.equal(d1)
				dn.should.not.be.equal(d2)
				success()
			}
			run([[f1, f2], fn], function (err) {
				process.domain.should.be.equal(d)
				d.exit()
				done(err)
			})
		})
	})

	it('should only accept output once from each filter', function (done) {
		function filter(success) {
			success(1)
			success(2)
		}

		function fn(n, success) {
			arguments.should.have.length(3)
			success(3)
		}

		run([[filter], fn], function (err, n) {
			should(err).be.null()
			n.should.be.equal(3)
			done()
		})
	})

	it('should not accept an error after success is called', function (done) {
		function filter(success, error) {
			success('filter')
			error('hi')
		}

		function fn(str, success) {
			str.should.be.equal('filter')
			success('fn')
		}

		run([[filter], fn], function (err, str) {
			should(err).be.null()
			str.should.be.equal('fn')
			done()
		})
	})

	it('should store all filter output and call the final callback with them', function (done) {
		// Two filters, three input values, two expected output values
		run([[filter1, filter2, filter3], fn], 'in1', 'in2', 'in3', function (err, out1, out2) {
			should(err).be.null()
			out1.should.be.equal('out1')
			out2.should.be.equal('out2')
			done()
		})

		function filter1(in1, in2, in3, success) {
			[in1, in2, in3].should.be.eql(['in1', 'in2', 'in3'])
			success('f1A', 'f1B')
		}

		function filter2(in1, in2, in3, success) {
			[in1, in2, in3].should.be.eql(['in1', 'in2', 'in3'])
			success()
		}

		function filter3(in1, in2, in3, success) {
			[in1, in2, in3].should.be.eql(['in1', 'in2', 'in3'])
			success('f3A')
		}

		function fn(in1, in2, in3, f1A, f1B, f3A, success) {
			[in1, in2, in3, f1A, f1B, f3A].should.be.eql(['in1', 'in2', 'in3', 'f1A', 'f1B', 'f3A'])
			success('out1', 'out2')
		}
	})
})