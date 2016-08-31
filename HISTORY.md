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