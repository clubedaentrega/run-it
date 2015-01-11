'use strict'

var domain = require('domain'),
	util = require('util')

/**
 * @class
 * @param {Function|Array<Function>} fns
 * @param {boolean} profile
 * @param {Function} errorClass
 * @param {boolean} enableErrorCode
 */
function Bind(fns, profile, errorClass, enableErrorCode) {
	if (!Array.isArray(fns)) {
		fns = [fns]
	}

	/** @member {Array<Function>} */
	this._filterFns = fns.slice(0, fns.length - 1)

	/** @member {Array<*>} */
	this._filterOutput = []

	/** @member {Function} */
	this._targetFn = fns[fns.length - 1]

	/** @member {boolean} */
	this._profile = profile

	/** @member {Function} */
	this._errorClass = errorClass

	/** @member {boolean} */
	this._enableErrorCode = enableErrorCode

	/** @member {?Domain} */
	this._domain = null

	/** @member {?Function} */
	this._done = null

	/** @member {?Array<*>} */
	this._input = null

	/** @member {number} */
	this._step = -1

	/** @member {boolean} */
	this._ended = false

	/** @member {Array<Object>} */
	this._profileData = []
}

module.exports = Bind

/**
 * @param {boolean} [value=true]
 * @returns {Bind} this
 */
Bind.prototype.profile = function (value) {
	this._profile = value === undefined ? true : value
	return this
}

/**
 * @param {Function} value
 * @returns {Bind} this
 */
Bind.prototype.errorClass = function (value) {
	this._errorClass = value
	return this
}

/**
 * @param {...*} data
 * @param {Function} done
 */
Bind.prototype.exec = function () {
	var len = arguments.length
	this._done = arguments[len - 1]
	this._input = [].slice.call(arguments, 0, len - 1)
	setImmediate(this._doStep.bind(this))
}

/**
 * @private
 */
Bind.prototype._doStep = function () {
	// Set up the domain
	this._step++
	this._domain = domain.create()
	this._domain.on('error', this._onerror.bind(this, this._step))

	// Create success and error functions
	var success = this._success.bind(this, this._step),
		error = this._createError(success),
		fn, args

	if (this._step < this._filterFns.length) {
		// Run filter
		fn = this._filterFns[this._step]
		args = this._input.concat([success, error])
	} else {
		// Run target function
		fn = this._targetFn
		args = this._input.concat(this._filterOutput, [success, error])
	}

	// Enter domain
	this._domain.run(function () {
		fn.apply(null, args)
	})
}

/**
 * @param {number} step
 * @param {Error} err
 * @private
 */
Bind.prototype._onerror = function (step, err) {
	// Ignore errors from previous steps
	if (step === this._step) {
		this._end(err)
	}
}

/**
 * @param {number} step
 * @param {...*} data
 * @private
 */
Bind.prototype._success = function (step) {
	if (step !== this._step) {
		// Ignore outputs from previous steps
		return
	}

	var data = [].slice.call(arguments, 1)
	if (this._step < this._filterFns.length) {
		// Add to filters output
		this._filterOutput.push.apply(this._filterOutput, data)

		// Execute next step out of the current domain
		this._domain.exit()
		setImmediate(this._doStep.bind(this))
		this._domain.enter()
	} else {
		// End
		this._end(null, data)
	}
}

/**
 * Execute the callback function outside of the domain
 * @param {?Error} err
 * @param {...*} data
 * @private
 */
Bind.prototype._end = function (err, data) {
	if (this._ended) {
		// Ignore future calls
		return
	}
	this._ended = true

	var fn = this._done,
		args = [err].concat(data)
	this._domain.exit()
	setImmediate(function () {
		fn.apply(null, args)
	})
	this._domain.enter()
	this._domain = null
}

/**
 * @param {Function} success
 * @returns {Function}
 * @private
 */
Bind.prototype._createError = function (success) {
	var domain = this._domain,
		that = this

	/*
	 * Three uses:
	 * error(fn) -> Function
	 * error(str,...x) or error(code,str,...x)
	 * error(x)
	 */
	var error = function () {
		var len = arguments.length,
			retFn, msg, errorObj
		if (len === 1 && typeof arguments[0] === 'function') {
			// error(fn) -> Function
			retFn = domain.intercept(arguments[0])
			if (!that._profile) {
				return retFn
			}

			// With profile
			var profileObj = prepareProfile(error)
			that._profileData.push(profileObj)
			return function () {
				profileObj.end = Date.now()
				profileObj.time = profileObj.begin - profileObj.end
				return retFn.apply(this, arguments)
			}
		} else if (len > 0 && !that._enableErrorCode && typeof arguments[0] === 'string') {
			// error(str,...x)
			msg = util.format.apply(util, arguments)
			throw new that._errorClass(msg)
		} else if (len > 1 && that._enableErrorCode && typeof arguments[1] === 'string') {
			// error(code,str,...x)
			msg = util.format.apply(util, [].slice.call(arguments, 1))
			errorObj = new that._errorClass(msg)
			errorObj.code = arguments[0]
			throw errorObj
		} else {
			// error(x)
			throw arguments[0]
		}
	}

	/**
	 * @param {...*} data
	 * @returns {Function}
	 */
	error.orOut = function () {
		var data = arguments
		return error(function () {
			success.apply(null, data)
		})
	}

	/**
	 * @param {number} [n]
	 * @returns {Function}
	 */
	error.orOuput = function (n) {
		return error(function () {
			var data = n === undefined ? arguments : [].slice.call(arguments, 0, n)
			success.apply(null, data)
		})
	}
	return error
}

/**
 * Find the call site name
 * This is very hacky and utterly linked to v8's stack trace API
 * See: https://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
 * @param {Function} leaf
 * @returns {Object}
 */
function prepareProfile(leaf) {
	var backup = Error.prepareStackTrace,
		err = new Error,
		callSite
	Error.prepareStackTrace = function (err, stack) {
		return stack[0]
	}
	Error.captureStackTrace(err, leaf)
	callSite = err.stack
	Error.prepareStackTrace = backup
	return {
		file: callSite.getFileName(),
		line: callSite.getLineNumber(),
		begin: Date.now()
	}
}