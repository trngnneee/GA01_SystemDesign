function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

function multiply(a, b) {
  return a * b;
}

function round(value, decimals) {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

const currencyFormatter = new Intl.NumberFormat("en-US");

function format_number(value) {
  return currencyFormatter.format(value);
}

export default {
  add,
  subtract,
  multiply,
  round,
  format_number,
};
