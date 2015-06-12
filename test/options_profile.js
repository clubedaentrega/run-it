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

	it('should probe error(fn) calls', function (done) {
		function filter(success, error) {
			setTimeout(error(function () {
				setTimeout(error.orOut(), 10, null)
			}), 10, null)
		}

		function fn(success, error) {
			setTimeout(error.orOut(), 10, null)
		}

		run([filter, fn]).profile().exec(function (err, profile) {
			profile.should.be.an.Array.and.have.length(2)
			profile[0].step.should.be.equal(0)
			profile[0].type.should.be.equal('filter')
			profile[0].begin.should.an.instanceof(Date)
			profile[0].end.should.an.instanceof(Date)
			profile[0].time.should.a.Number
			profile[0].times.should.an.Array.and.have.length(2)
			profile[1].times.should.an.Array.and.have.length(1)
			profile[1].type.should.be.equal('target')
			done()
		})
	})
})