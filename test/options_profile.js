/*globals describe, it*/
'use strict'

var run = require('../')()
require('should')

describe('options: profile', function () {
	it('should have profiling disabled by default', function (done) {
		run.profile.should.be.false
		run(function (success) {
			success()
		}, function () {
			arguments.should.have.length(1) // err
			done()
		})
	})
	
	it('should let enable profiling globally', function (done) {
		run.profile = true
		run(function (success) {
			success()
		}, function (err, profile) {
			arguments.should.have.length(2)
			profile.should.be.an.Array
			done()
		})
		run.profile = false
	})
	
	it('should let enable profiling on demand', function (done) {
		run.profile.should.be.false
		run(function (success) {
			success()
		}).profile().exec(function (err, profile) {
			arguments.should.have.length(2)
			profile.should.be.an.Array
			done()
		})
		run.profile.should.be.false
	})
})