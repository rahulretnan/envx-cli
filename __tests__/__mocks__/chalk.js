// Global chalk mock for Jest (CJS). The real chalk v5 is ESM-only,
// which ts-jest in CJS mode cannot load. Since tests don't assert on
// ANSI color codes, a passthrough mock is sufficient.

const identity = str => String(str);

const proxy = new Proxy(identity, {
  get: () => proxy,
  apply: (_target, _thisArg, args) => args.map(String).join(' '),
});

module.exports = proxy;
module.exports.default = proxy;
