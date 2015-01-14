'use strict'

var domain = require('domain'),
	util = require('util'),
	path = require('path')

/**
 * @class
 * @param {Function|Array<Function>} fns
 * @param {Object} options
 * @param {string} options.basePath
 * @param {boolean} options.profile
 * @param {Function} options.errorClass
 * @param {boolean} options.enableErrorCode
 */
function Bind(fns, options) {
	if (!Array.isArray(fns)) {
		fns = [fns]
	}

	/** @member {Array<Function>} */
	this._filterFns = fns.slice(0, fns.length - 1)

	/** @member {Array<*>} */
	this._filterOutput = []

	/** @member {Function} */
	this._targetFn = fns[fns.length - 1]

	/** @member {string} */
	this._basePath = options.basePath

	/** @member {boolean} */
	this._profile = options.profile

	/** @member {Function} */
	this._errorClass = options.errorClass

	/** @member {boolean} */
	this._enableErrorCode = options.enableErrorCode

	/** @member {?Domain} */
	this._initialDomain = null

	/** @member {?Domain} */
	this._domain = null

	/** @member {?Function} */
	this._done = null

	/** @member {?Array<*>} */
	this._input = null

	/** @member {number} */
	this._step = 0

	/** @member {boolean} */
	this._ended = false

	/** @member {Array<Object>} */
	this._profileData = []
}

module.exports = Bind

/**
 * @param {boolean|string} [value=true]
 * @returns {Bind} this
 */
Bind.prototype.profile = function (value) {
	if (typeof value === 'string') {
		this._basePath = value
		this._profile = true
	} else {
		this._profile = value === undefined ? true : value
	}
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
	this._initialDomain = process.domain
	setImmediate(this._doStep.bind(this))
}

/**
 * @private
 */
Bind.prototype._doStep = function () {
	// Set up the domain
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

	// Prepare profile data
	if (this._profile) {
		this._profileData.push({
			step: this._step,
			begin: Date.now(),
			times: []
		})
	}

	// Enter domain
	this._domain.enter()
	fn.apply(null, args)
}

/**
 * @param {number} step
 * @param {Error} err
 * @private
 */
Bind.prototype._onerror = function (step, err) {
	if (step !== this._step) {
		// Ignore errors from previous steps
		return
	}
	this._step++

	if (this._profile) {
		var last = this._profileData[this._profileData.length - 1]
		last.end = Date.now()
		last.time = last.end - last.begin
	}

	this._end(err, [])
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
	this._step++

	if (this._profile) {
		var last = this._profileData[this._profileData.length - 1]
		last.end = Date.now()
		last.time = last.end - last.begin
	}

	var data = [].slice.call(arguments, 1)
	if (this._step <= this._filterFns.length) {
		// Add to filters output
		this._filterOutput.push.apply(this._filterOutput, data)

		// Execute next step out of the current domain
		this._execOutside(this._doStep.bind(this))
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
	if (this._profile) {
		args.push(this._profileData)
	}
	this._execOutside(function () {
		fn.apply(null, args)
	})
	this._domain = null
}

/**
 * @param {Function} success
 * @returns {Function}
 * @private
 */
Bind.prototype._createError = function (success) {
	var domain = this._domain,
		step = this._step,
		that = this

	/**
	 * @param {Function} fn
	 * @param {Function} leaf - for prepareProfile
	 * @returns {Function}
	 */
	function intercept(fn, leaf) {
		var retFn = domain.intercept(fn)
		if (!that._profile) {
			return retFn
		}

		// With profile
		var profileObj = prepareProfile(leaf, that._basePath)
		that._profileData[step].times.push(profileObj)
		return function () {
			profileObj.end = Date.now()
			profileObj.time = profileObj.end - profileObj.begin
			return retFn.apply(this, arguments)
		}
	}

	/*
	 * Three uses:
	 * error(fn) -> Function
	 * error(str,...x) or error(code,str,...x)
	 * error(x)
	 */
	var error = function () {
		var len = arguments.length,
			msg, errorObj
		if (len === 1 && typeof arguments[0] === 'function') {
			// error(fn) -> Function
			return intercept(arguments[0], error)
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
		return intercept(function () {
			success.apply(null, data)
		}, error.orOut)
	}

	/**
	 * @param {number} [n]
	 * @returns {Function}
	 */
	error.orOutput = function (n) {
		return intercept(function () {
			var data = n === undefined ? arguments : [].slice.call(arguments, 0, n)
			success.apply(null, data)
		}, error.orOutput)
	}
	return error
}

/**
 * Run a given function in another tick outside of any domain
 * @param {Function} fn
 * @private
 */
Bind.prototype._execOutside = function (fn) {
	var initialDomain = this._initialDomain
	setImmediate(function () {
		while (process.domain) {
			process.domain.exit()
		}
		if (initialDomain) {
			initialDomain.run(fn)
		} else {
			fn()
		}
	})
}

/**
 * Find the call site name
 * This is very hacky and utterly linked to v8's stack trace API
 * See: https://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
 * @param {Function} leaf
 * @param {string} basePath
 * @returns {Object}
 */
function prepareProfile(leaf, basePath) {
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
		file: path.relative(basePath, callSite.getFileName()),
		line: callSite.getLineNumber(),
		begin: Date.now()
	}
}