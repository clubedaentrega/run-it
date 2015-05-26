'use strict'

var Runner = require('./lib/Runner')

/**
 * @returns {Function}
 */
module.exports = function () {
	/**
	 * Two uses:
	 * * run(fns) -> Runner
	 * * run(fns, data, done)
	 * @param {Function|Array<Function>} fns
	 * @param {...*} [data]
	 * @param {Function} [done]
	 * @returns {?Runner}
	 */
	var run = function (fns) {
		var isArr = Array.isArray,
			preFns = [],
			postFns = [],
			targetFn

		if (!isArr(fns)) {
			fns = [fns]
		}

		// Prepare functions
		var hasArray = fns.some(isArr)
		if (fns.length === 3 && isArr(fns[0]) && !isArr(fns[1]) && isArr(fns[2])) {
			// run([preFns, targetFn, postFns])
			preFns = fns[0]
			targetFn = fns[1]
			postFns = fns[2]
		} else if (fns.length === 2 && isArr(fns[0]) && !isArr(fns[1])) {
			// run([preFns, targetFn])
			preFns = fns[0]
			targetFn = fns[1]
		} else if (fns.length === 2 && !isArr(fns[0]) && isArr(fns[1])) {
			// run([targetFn, postFns])
			targetFn = fns[0]
			postFns = fns[1]
		} else if (fns.length === 1 && !isArr(fns[0])) {
			// run([targetFn])
			targetFn = fns[0]
		} else if (!hasArray) {
			// run([...preFns, targetFn])
			preFns = fns.slice(0, fns.length - 1)
			targetFn = fns[fns.length - 1]
		} else {
			throw new Error('Invalid functions argument')
		}

		var len = arguments.length,
			runner = new Runner(preFns, targetFn, postFns, run)
		if (len === 1) {
			// run(fns)
			return runner
		}

		runner.exec.apply(runner, [].slice.call(arguments, 1))
	}

	/** @member {string} */
	run.basePath = ''

	/** @member {boolean} */
	run.profile = false

	/** @member {Function} */
	run.errorClass = Error

	/** @member {boolean} */
	run.enableErrorCode = false

	return run
}