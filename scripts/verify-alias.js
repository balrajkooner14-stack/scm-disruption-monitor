// Map the "@/lib/<name>" requires that tsc leaves in .verify/ output onto the
// compiled files themselves. Required at the top of any harness that loads a
// module importing via the "@/" alias.
const Module = require("module");
const path = require("path");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@/lib/")) {
    request = path.join(__dirname, "..", ".verify", request.slice("@/lib/".length));
  }
  return original.call(this, request, ...rest);
};
