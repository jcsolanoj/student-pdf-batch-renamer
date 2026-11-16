/**
 * Interfaz web de student-pdf-batch-renamer (100% local, DOM seguro sin innerHTML).
 */

document.addEventListener("DOMContentLoaded", () => {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("zip-input");
  const delimiterInput = document.getElementById("input-delimiter");
  const partIndexInput = document.getElementById("input-part-index");
  const tableBody = document.getElementById("results-body");
  const statsEl = document.getElementById("stats-text");
  const statusEl = document.getElementById("status-bar");

  const btnExportZip = document.getElementById("btn-export-zip");
  const btnSaveFolder = document.getElementById("btn-save-folder");
  const btnDownloadIndividual = document.getElementById("btn-download-individual");

  let currentItems = [];
  let currentZipName = "PDFs_Renombrados";

  function setStatus(message, type = "info") {
    statusEl.textContent = message;
    statusEl.className = `status-bar ${type}`;
  }

  function updateButtonsState() {
    const hasItems = currentItems.length > 0;
    btnExportZip.disabled = !hasItems;
    btnDownloadIndividual.disabled = !hasItems;
    btnSaveFolder.disabled = !hasItems || typeof window.showDirectoryPicker !== "function";
  }

  function recalculateFilenames() {
    currentItems = resolveUniqueFilenames(currentItems);
    renderTable();
  }

  function renderTable() {
    tableBody.replaceChildren();

    currentItems.forEach((item, idx) => {
      const tr = document.createElement("tr");

      const tdIdx = document.createElement("td");
      tdIdx.textContent = String(idx + 1);

      const tdOrig = document.createElement("td");
      tdOrig.className = "mono";
      tdOrig.textContent = item.entryPath;

      const tdBase = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      input.className = "name-edit";
      input.value = item.baseName;
      input.addEventListener("change", () => {
        currentItems[idx].baseName = input.value;
        recalculateFilenames();
      });
      tdBase.appendChild(input);

      const tdOut = document.createElement("td");
      tdOut.className = "mono";
      tdOut.textContent = item.outputFilename;

      tr.appendChild(tdIdx);
      tr.appendChild(tdOrig);
      tr.appendChild(tdBase);
      tr.appendChild(tdOut);
      tableBody.appendChild(tr);
    });

    statsEl.textContent = `${currentItems.length} PDF(s) listos para exportar`;
    updateButtonsState();
  }

  async function processZipFile(file) {
    if (!file || !file.name.toLowerCase().endsWith(".zip")) {
      setStatus("Selecciona un archivo .zip válido.", "error");
      return;
    }

    currentZipName = sanitizeFilename(file.name.replace(/\.zip$/i, ""));
    setStatus(`Leyendo ${file.name} localmente...`);

    try {
      const zip = await JSZip.loadAsync(file);
      const delimiter = delimiterInput.value;
      const partIndex = Math.max(0, parseInt(partIndexInput.value || "0", 10));

      const rawItems = [];
      let totalSize = 0;

      for (const [entryPath, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        if (/(^|[\\/])__MACOSX([\\/]|$)/.test(entryPath)) continue;
        if (!entry.name.toLowerCase().endsWith(".pdf")) continue;

        const uncompressedSize = entry._data?.uncompressedSize || 0;
        if (uncompressedSize > MAX_ENTRY_BYTES) {
          continue;
        }
        totalSize += uncompressedSize;
        if (totalSize > MAX_TOTAL_BYTES) {
          throw new Error("El archivo ZIP supera el límite de seguridad de 1 GB descomprimido.");
        }

        const baseName = extractStudentName(entryPath, { delimiter, partIndex });
        rawItems.push({
          entryPath,
          entry,
          baseName,
          extension: ".pdf",
        });
      }

      currentItems = resolveUniqueFilenames(rawItems);
      renderTable();

      if (currentItems.length === 0) {
        setStatus("El ZIP no contiene archivos .pdf válidos.", "error");
      } else {
        setStatus(`Cargados ${currentItems.length} PDF(s) correctamente. Puedes editar los nombres antes de exportar.`, "success");
      }
    } catch (err) {
      currentItems = [];
      renderTable();
      setStatus(`Error procesando el ZIP: ${err.message}`, "error");
    }
  }

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      processZipFile(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
      processZipFile(fileInput.files[0]);
    }
  });

  [delimiterInput, partIndexInput].forEach((el) => {
    el.addEventListener("change", () => {
      if (currentItems.length === 0) return;
      const delimiter = delimiterInput.value;
      const partIndex = Math.max(0, parseInt(partIndexInput.value || "0", 10));
      currentItems = currentItems.map((item) => ({
        ...item,
        baseName: extractStudentName(item.entryPath, { delimiter, partIndex }),
      }));
      recalculateFilenames();
    });
  });

  btnExportZip.addEventListener("click", async () => {
    if (currentItems.length === 0) return;
    setStatus("Generando paquete ZIP limpio...");
    try {
      const outZip = new JSZip();
      for (const item of currentItems) {
        const buffer = await item.entry.async("arraybuffer");
        outZip.file(item.outputFilename, buffer);
      }
      const blob = await outZip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PDFs_${currentZipName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`Paquete PDFs_${currentZipName}.zip descargado exitosamente.`, "success");
    } catch (err) {
      setStatus(`Error generando ZIP: ${err.message}`, "error");
    }
  });

  btnSaveFolder.addEventListener("click", async () => {
    if (currentItems.length === 0 || typeof window.showDirectoryPicker !== "function") return;
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      setStatus("Guardando archivos en la carpeta seleccionada...");
      for (const item of currentItems) {
        const fileHandle = await dirHandle.getFileHandle(item.outputFilename, { create: true });
        const writable = await fileHandle.createWritable();
        const buffer = await item.entry.async("arraybuffer");
        await writable.write(buffer);
        await writable.close();
      }
      setStatus(`Se guardaron ${currentItems.length} PDF(s) en la carpeta elegida.`, "success");
    } catch (err) {
      if (err.name !== "AbortError") {
        setStatus(`No se pudo guardar en carpeta: ${err.message}`, "error");
      }
    }
  });

  btnDownloadIndividual.addEventListener("click", async () => {
    if (currentItems.length === 0) return;
    setStatus("Descargando archivos individualmente...");
    for (const item of currentItems) {
      const buffer = await item.entry.async("arraybuffer");
      const blob = new Blob([buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.outputFilename;
      a.click();
      URL.revokeObjectURL(url);
      await new Promise((r) => setTimeout(r, 120));
    }
    setStatus(`Descarga de ${currentItems.length} archivo(s) completada.`, "success");
  });

  updateButtonsState();
});
