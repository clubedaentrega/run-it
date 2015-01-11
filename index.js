'use strict'

var Bind = require('./lib/Bind')

/**
 * @returns {Function}
 */
module.exports = function () {
	/**
	 * Two uses:
	 * * run(fn) -> Bind
	 * * run(fn, data, done)
	 * @param {Function|Array<Function>} fns
	 * @param {...*} [data]
	 * @param {Function} [done]
	 * @returns {?Bind}
	 */
	var run = function (fns) {
		var len = arguments.length
		if (len === 1) {
			// run(fn)
			return new Bind(fns, run.profile, run.errorClass, run.enableErrorCode)
		}

		var bind = new Bind(fns, run.profile, run.errorClass, run.enableErrorCode)
		bind.exec.apply(bind, [].slice.call(arguments, 1))
	}

	/** @member {boolean} */
	run.profile = false

	/** @member {Function} */
	run.errorClass = Error

	/** @member {boolean} */
	run.enableErrorCode = false

	return run
}