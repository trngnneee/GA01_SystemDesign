function format_number(price) { return new Intl.NumberFormat('en-US').format(price); }

function range(start, end) {
  const result = [];
  for (let i = start; i < end; i++) {
    result.push(i);
  }
  return result;
}

function length(arr) {
  return Array.isArray(arr) ? arr.length : 0;
}

export default {
  format_number,
  range,
  length,
};