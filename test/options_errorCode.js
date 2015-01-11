/*globals describe, it*/
'use strict'

var run = require('../')()
require('should')

describe('options: enableErrorCode', function () {
	it('should be disabled by default', function (done) {
		run.enableErrorCode.should.be.false
		run(function (success, error) {
			error('hi')
		}, function (err) {
			err.message.should.be.equal('hi')
			done()
		})
	})

	it('should let change it globally', function (done) {
		run.enableErrorCode = true
		run(function (success, error) {
			error(12, 'hi')
		}, function (err) {
			err.message.should.be.equal('hi')
			err.code.should.be.equal(12)
			done()
		})
		run.enableErrorCode = false
	})
})