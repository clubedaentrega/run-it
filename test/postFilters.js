/*globals describe, it*/
'use strict'

var run = require('../')(),
	should = require('should')

describe('post filters', function () {
	it('should execute each post filter in sequence', function (done) {
		var order = 0

		function fn(success) {
			order.should.be.equal(0)
			order = 1
			success()
		}

		function pf1(success) {
			order.should.be.equal(1)
			order = 2
			success()
		}

		function pf2(success) {
			order.should.be.equal(2)
			order = 3
			success()
		}

		run([fn, [pf1, pf2]], function (err) {
			should(err).be.null
			order.should.be.equal(3)
			order = 4
			done(err)
		})
	})

	it('should be possible to change output data', function (done) {
		function fn(success) {
			success(12)
		}

		function postFilter(n, success) {
			n.should.be.equal(12)
			success(2 * n, 17)
		}

		run([fn, [postFilter]], function (err, n1, n2) {
			should(err).be.null
			n1.should.be.equal(24)
			n2.should.be.equal(17)
			done()
		})
	})

	it('should work for the README example', function (done) {
		function add(body, success) {
			success(body.a + body.b)
		}

		function check(response, success) {
			if (typeof response !== 'number') {
				throw new Error('Uhm, not a number...')
			}
			success(response)
		}

		var body = {
			a: 3,
			b: '14'
		}

		run([add, [check]], body, function (err) {
			err.message.should.be.equal('Uhm, not a number...')
			done()
		})
	})
})