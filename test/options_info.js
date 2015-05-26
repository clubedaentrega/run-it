/*globals describe, it*/
'use strict'

var run = require('../')(),
	should = require('should')

describe('options: info', function () {
	it('should populate runInfo for filters and target function', function (done) {
		var obj = {
			arr: []
		}

		function f(success) {
			var info = process.domain.runInfo
			info.should.be.equal(obj)
			info.arr.push(info.arr.length)
			setTimeout(function () {
				process.domain.runInfo.should.be.equal(obj)
				success()
			}, 10)
		}

		run([[f, f], f, [f, f]]).runInfo(obj).exec(function (err) {
			should(err).be.null
			obj.arr.should.be.eql([0, 1, 2, 3, 4])
			done()
		})
	})
})