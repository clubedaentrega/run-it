/*globals describe, it*/
'use strict'

var run = require('../')()
require('should')

function MyErrorClass(msg) {
	this.customMsg = msg
}

describe('options: errorClass', function () {
	it('should have Error as the default error class', function (done) {
		run.errorClass.should.be.equal(Error)
		run(function (success, error) {
			error('hi')
		}, function (err) {
			err.should.be.instanceof(Error)
			err.message.should.be.equal('hi')
			done()
		})
	})

	it('should let change it globally', function (done) {
		run.errorClass = MyErrorClass
		run(function (success, error) {
			error('hi')
		}, function (err) {
			err.should.be.instanceof(MyErrorClass)
			err.customMsg.should.be.equal('hi')
			done()
		})
		run.errorClass = Error
	})

	it('should let change it on demand', function (done) {
		run.errorClass.should.be.equal(Error)
		run(function (success, error) {
			error('hi')
		}).errorClass(MyErrorClass).exec(function (err) {
			err.should.be.instanceof(MyErrorClass)
			err.customMsg.should.be.equal('hi')
			done()
		})
		run.errorClass.should.be.equal(Error)
	})
})