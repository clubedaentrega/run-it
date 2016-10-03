# 3.0.0
## Breaking changes
* Changed: minimum support for node v4
* Changed: `error()` functions no longer accept multiple arguments to format message
* Changed: `error()` functions now accept an extra optional object parameter, used to copy properties to error instance.
* Changed: `error(str, ...x)` to `error(str, ?obj)`
* Changed: `error(code, str, ...x)` to `error(code, str, ?obj)`
* Changed: `error(x)` to `error(x, ?obj)`

# 2.1.1
* Fixed: make sure exceptions thrown directly inside `error()` and `error.wrap()` get correctly routed to Node.js

# 2.1.0
* Added: `error.wrap(fn)`. It works much like `error(fn)`, but does not swallow the first argument. Use this around async calls you need the `err` argument.

# 2.0.0
* Changed: `begin` and `end` in profile data are instances of Dates (they were number)

# 1.3.0
* Added: run state info: share data across all actions with `process.domain.runInfo`

# 1.2.0
* Added: post filters