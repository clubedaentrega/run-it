# Run it
A Node.js module to ease error handling and let you get rid of if(err) return cb(err)

## Install
`npm install run-it --save`

## Motivation
Node.js is great, but after writing `if(err) return cb(err)` a million times one may get tired.
A good solution is to use the core [domain](http://nodejs.org/api/domain.html) module. This module builds on top of that to provide a clean interface and some strong guarantees about error handling:

* execute a function and get all thrown execptions, including asynchronous ones
* call async routines without having to check about the first `err` parameter
* write error messages with placeholders, like: `Sorry, user %s does not exist`
* no more `return` pitfall: `cb(new Error('Something went wrong, but as I have forgot to return, my code will continue after this...'))`
* support for asynchronous functions that run before the target function
* support to profile async calls

## Basic Usage
```js
var run = require('run-it')(),
	fs = require('fs')

// Read the file as JSON and return the data in the `name` field
function getName(file, success, error) {
	// error(fn) will take care of the error parameter for you
	fs.readFile(file, error(function (data) {
		data = new Buffer(data, 'utf8')
		if (!data.length) {
			// No need to use return here, error(str,...) will throw
			error('File %s is empty', file)
		}
		// No try{...}catch{...} over here
		data = JSON.parse(data)
		// Note that success *WILL NOT* throw, so code can continue after success
		success(data.name)
	}))
}

run(getName, 'README.md', function (err, name) {
	// here we're back to normal nodejs behaviour
})
```

## What is this for?
This module was created as a solution to isolate errors for each endpoint in a WebService. This way, if one request fails, that request (only) is answered with error, the error is properly logged and the API stays up and running.

This module was not created to let you ignore errors nor simply turn uncaught exceptions into error values with no consequences. Think deeply about your use case before using this as a general solution.

It's a common advise (and a reasonable one) to restart the whole application after an uncaught exception, since the application may have entered a corrupted state. In the use case described above (endpoints in a WS), if all endpoints are stateless and isolated, them restarting is no longer needed and this solution fits well.

## Filters
To run other async functions before the final one, like some auth routine to exchange a login token for user data, pass an array of function as first argument:

```js
// An async operation example (load user from database)
function auth(body, success, error) {
	findUserByToken(body.token, error(function (user) {
		user ? success(user) : error('Invalid token')
	}))
}

// Target function. `user` is the output from the auth filter
function changeName(body, user, success, error) {
	user.name = body.newName
	user.save(error(function () {
		success()
	}))
	// Another way of coding the above is:
	// user.save(error.orOut())
}

var body = {
	token: '1234',
	newName: 'CdE'
}

// The target function is the second element in the array
// The first element is an array of filters
run([[auth], changeName], body, function (err, data) {
	// ...
})

// Another way is to list all functions in a flat array
// The target function is the last element of the array
run([auth, changeName], body, function (err, data) {
	// ...
})
```

If more than one filter is given, all them will be called with the same arguments and be executed in series. The output values of each will be concatenated and sent to the target function.

## Post filters
To run other async functions after the target, like some output checking routine, pass an array after the target function:

```js
// Target function
function add(body, success, error) {
	success(body.a + body.b)
}

// Post processing: output sanity
function check(response, success, error) {
	if (typeof response !== 'number') {
		throw new Error('Uhm, not a number...')
	}
	// Post filters can change completely the output
	// To let it unchanged, you must call success with it
	success(response)
}

var body = {
	a: 3,
	b: '14'
}

// The target function is the first element in the array
// The second element is an array of post filters
run([add, [check]], body, function (err, sum) {
	// ...
})
```

If more than one post filter is given, they will be executed sequentially. The output of the previous will be the input for the next (waterfall). The output of the last one is the final output.

The syntax to use both filters and post filters is
```js
run([[filter1, filter2], target, [postFilter1, postFilter2]], body, callback)
```

## Profiling
If you enable profiling, each call to `error(fn)` will be traced. The `begin` Date is when the `error` function was executed. The `end` is when the `fn` function was executed, ie when the async operation has finished. `time` is `end - begin`.

```js
// Enabling globally
run.profile = true

// On demand
run(fn).profile(/*true*/).exec(data, function (err, data, profile) {
	// `profile` is an array with at most one element for each
	// function (each filter + the target function). Each element is
	// an object like:
	// {step: number, type: string, begin: Date, end: Date, time: number, times: [Time]}
	// `type` is one of 'filter', 'target', 'post filter'
	// Each element of `times` is an object that represents each `error(fn)` call site:
	// {file: string, line: number, begin: Date, end: Date, time: number}
	// `begin`, `end` and `time` are all in ms
})

// Set base path for the `file` key (passed to `path.relative(from, to)`)
run.basePath = __dirname
// or on demand `run(fn).profile(__dirname)`
```

## Error class
By default, errors created by `error(str,...)` will be instantiated from `Error`. But sometimes it's useful to tell errors created this way apart from other errors, like the ones created by `fs.readFile`. To do that:

```js
// Global setting
run.errorClass = MyError

// On demand
run(fn).errorClass(MyError).exec(data, function (err, data) {
	if (err instanceof MyError) {
		// it was created by error(str,...)
	}
})
```

## Error codes
One common pattern for errors is to use a code to identify them. Enabling this option, `error(code,str,...)` must be used instead of `error(str,...)`. This is a global option:

```js
run.enableErrorCode = true
run(function (data, success, error) {
	error(100, 'O.o')
}, data, function (err, data) {
	// ...
})
```

## Error function
The `error` function has a set of different uses. They're summarized here:

* `error(fn)`: wrap the given function and return a node-style error-first callback. Works like [domain.intercept](http://nodejs.org/api/domain.html#domain_domain_intercept_callback). If profiling is enabled, these calls are used to probe code execution
* `error(str,...x)`: throw an error (by default, instanceof Error) with the given message. The message may have placeholders. See [util.format](http://nodejs.org/api/util.html#util_util_format_format) for more on this. The message is required.
* `error(code,str,...x)`: if error code is enabled, throw an error (by default, instanceof Error) with the given message and add the given code as `code` property in the error object. The message is required.
* `error(x)`: error out with the given value (it should be an Error instance, but not necessarily)
* `error.orOut(...x)`: same as `error(function () {success(...x)})`
* `error.orOutput()`: same as `error(function (...args) {success(...args)})`
* `error.orOutput(n)`: same as `error(function (...args) {success(...args.slice(0, n))})`

## Domains and execution data
Every function is executed in its own [domain](https://nodejs.org/api/domain.html). Those domains may share some run state:
```js
var someState = []
function fn(success, error) {
	assert(process.domain.runInfo === someState)
	setTimeout(function () {
		assert(process.domain.runInfo === someState)
		someState.push('hi')
		success()
	}, 1e3)
}
run([fn, fn]).runInfo(someState).exec(function (err) {
	assert(someState.length === 2)
})
```

## Multiple arguments
All examples above were presented with only one argument being returned/received, since this is most common practice. But multiple arguments are supported as well:
```js
// Two filters, three input values, two expected output values
run([filter1, filter2, fn], in1, in2, in3, function (err, out1, out2) {
	// ...
})

// All filters are called with the same arguments
function filter1(in1, in2, in3, success, error) {
	// Two output values from this filter
	success(f1A, f1B)
}

function filter2(in1, in2, in3, success, error) {
	// No output from this one
	success()
}

// Three initial arguments + two from the first filter + zero from the second
function fn(in1, in2, in3, f1A, f1B, success, error) {
	// Two outputs
	success(out1, out2)
}
```