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
  const factor = Math.pow(10, decimals); // KISS-4: tính một lần, dùng lại
  return Math.round(value * factor) / factor;
}

const currencyFormatter = new Intl.NumberFormat("en-US");

export function format_number(value) {
  return currencyFormatter.format(value);
}

export default {
  add,
  subtract,
  multiply,
  round,
  format_number,
};
