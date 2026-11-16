/**
 * Lógica pura de extracción, saneamiento y desambiguación de nombres de archivos PDF.
 * Compatible con navegadores y Node.js (>=18).
 */

const RESERVED_WINDOWS_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

const MAX_ENTRY_BYTES = 100 * 1024 * 1024; // 100 MB por PDF
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024; // 1 GB total por lote

/**
 * Limpia caracteres inválidos en nombres de archivo, traversal (..) y nombres reservados de Windows.
 */
function sanitizeFilename(name) {
  if (typeof name !== "string") return "Sin_Nombre";
  let clean = name
    .replace(/\uFFFD/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\.\.+/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "");

  if (!clean || /^_+$/.test(clean)) clean = "Sin_Nombre";
  if (RESERVED_WINDOWS_NAMES.has(clean.toUpperCase())) {
    clean = `_${clean}`;
  }
  return clean;
}

/**
 * Extrae el nombre base del estudiante desde la ruta dentro del ZIP.
 */
function extractStudentName(entryPath, options = {}) {
  const delimiter = options.delimiter ?? "_";
  const partIndex = Number.isInteger(options.partIndex) ? options.partIndex : 0;

  const parts = String(entryPath || "")
    .split(/[\\/]/)
    .filter(Boolean);

  if (parts.length === 0) return "Sin_Nombre";

  const targetSegment = parts.length >= 2
    ? parts[0]
    : parts[0].replace(/\.pdf$/i, "");

  if (!delimiter) {
    return sanitizeFilename(targetSegment);
  }

  const tokens = targetSegment.split(delimiter);
  const picked = tokens[partIndex] !== undefined ? tokens[partIndex] : tokens[0];
  return sanitizeFilename(picked);
}

/**
 * Resuelve colisiones globales (case-insensitive) asignando sufijos _1, _2...
 */
function resolveUniqueFilenames(items) {
  const usedNames = new Set();
  const multiCounts = new Map();

  // Contar cuántos archivos pertenecen al mismo nombre base saneado
  for (const item of items) {
    const baseKey = sanitizeFilename(item.baseName).toLowerCase();
    multiCounts.set(baseKey, (multiCounts.get(baseKey) || 0) + 1);
  }

  const perBaseIndex = new Map();

  return items.map((item) => {
    const cleanBase = sanitizeFilename(item.baseName);
    const ext = item.extension && item.extension.startsWith(".") ? item.extension : ".pdf";
    const baseKey = cleanBase.toLowerCase();
    const totalForBase = multiCounts.get(baseKey) || 1;

    const currentIdx = (perBaseIndex.get(baseKey) || 0) + 1;
    perBaseIndex.set(baseKey, currentIdx);

    let candidate = totalForBase > 1
      ? `${cleanBase}_${currentIdx}${ext}`
      : `${cleanBase}${ext}`;

    let fallbackCounter = currentIdx;
    while (usedNames.has(candidate.toLowerCase())) {
      fallbackCounter++;
      candidate = `${cleanBase}_${fallbackCounter}${ext}`;
    }

    usedNames.add(candidate.toLowerCase());
    return {
      ...item,
      cleanBase,
      outputFilename: candidate,
    };
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MAX_ENTRY_BYTES,
    MAX_TOTAL_BYTES,
    sanitizeFilename,
    extractStudentName,
    resolveUniqueFilenames,
  };
}
