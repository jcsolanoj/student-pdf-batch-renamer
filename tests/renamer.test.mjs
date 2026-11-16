import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { sanitizeFilename, extractStudentName, resolveUniqueFilenames } = require("../src/renamer.js");

test("sanitizeFilename blocks Zip Slip and Windows reserved names", () => {
  assert.equal(sanitizeFilename("../../Users/Public/evil"), "____Users_Public_evil");
  assert.equal(sanitizeFilename("CON"), "_CON");
  assert.equal(sanitizeFilename("  ANA: MARIA*?.pdf  "), "ANA_ MARIA__.pdf");
  assert.equal(sanitizeFilename("..."), "Sin_Nombre");
});

test("extractStudentName handles both / and \\ separators", () => {
  assert.equal(
    extractStudentName("MARIA LOPEZ_100001_assignsubmission_file/tarea.pdf"),
    "MARIA LOPEZ"
  );
  assert.equal(
    extractStudentName("CARLOS PEREZ_100002_assignsubmission_file\\doc.pdf"),
    "CARLOS PEREZ"
  );
  assert.equal(extractStudentName("entrega_suelta.pdf"), "entrega");
});

test("resolveUniqueFilenames deduplicates case-insensitively", () => {
  const result = resolveUniqueFilenames([
    { baseName: "ANA GARCIA", extension: ".pdf" },
    { baseName: "ANA GARCIA", extension: ".pdf" },
    { baseName: "ana garcia", extension: ".pdf" },
    { baseName: "LUIS TORRES", extension: ".pdf" },
  ]);
  assert.deepEqual(
    result.map((r) => r.outputFilename),
    ["ANA GARCIA_1.pdf", "ANA GARCIA_2.pdf", "ana garcia_3.pdf", "LUIS TORRES.pdf"]
  );
});
