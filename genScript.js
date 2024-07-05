const crypto = require("crypto");

// Generate a 32-byte (256-bit) encryption key
const encryptionKey = crypto.randomBytes(32).toString("hex");
console.log(encryptionKey);
