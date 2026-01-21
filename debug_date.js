
const startDateStr = "2026-01-21";

console.log("Input String:", startDateStr);
console.log("Server Local TimeString:", new Date().toString());

// Logic in existing code
const startOfRange = new Date(startDateStr);
console.log("Parsed (UTC Midnight):", startOfRange.toISOString());
console.log("Parsed (Local):", startOfRange.toString());

startOfRange.setHours(0, 0, 0, 0);
console.log("After setHours(0) ISO:", startOfRange.toISOString());

// Proposed fix
const startOfRangeFixed = new Date(startDateStr);
startOfRangeFixed.setUTCHours(0, 0, 0, 0);
console.log("After setUTCHours(0) ISO:", startOfRangeFixed.toISOString());
