function eq(a, b) { return a === b; }
function ne(a, b) { return a !== b; }
function gt(a, b) { return a > b; }
function gte(a, b) { return a >= b; }
function lt(a, b) { return a < b; }
function lte(a, b) { return a <= b; }

function and(...args) {
  return args.slice(0, -1).every(Boolean);
}

function or(...args) {
  return args.slice(0, -1).some(Boolean);
}

export default {
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  and,
  or,
};