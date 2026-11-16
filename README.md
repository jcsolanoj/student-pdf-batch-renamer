# Student PDF Batch Renamer

Herramienta docente 100% local y sin servidor para **extraer y renombrar masivamente archivos PDF** desde descargas `.zip` de plataformas educativas (Moodle, Canvas, Microsoft Teams).

---

## ¿Qué problema resuelve?

Cuando descargas todas las entregas de una tarea en Moodle/LMS, obtienes un `.zip` lleno de subcarpetas individuales:

```text
Entregas_Tarea1.zip
├── MARIA FERNANDA LOPEZ_100001_assignsubmission_file/
│   └── tarea_final.pdf
└── CARLOS ANDRES PEREZ_100002_assignsubmission_file/
    └── documento_1.pdf
```

**Student PDF Batch Renamer** extrae todos los PDFs en una sola carpeta plana, renombrándolos automáticamente con el nombre de cada estudiante (`MARIA FERNANDA LOPEZ.pdf`, `CARLOS ANDRES PEREZ.pdf`) y desambiguando múltiples archivos (`_1`, `_2`).

---

## Dos formas de uso

### Opción 1: Aplicación Web Local (Multiplataforma, 100% offline)

1. Descarga el repositorio (botón **Code → Download ZIP** y descomprime, o usa `git clone https://github.com/jcsolanoj/student-pdf-batch-renamer.git`).
2. Abre `index.html` en tu navegador (o publícalo en GitHub Pages / Netlify).
3. Arrastra el `.zip` de entregas, ajusta el delimitador si es necesario (`_` por defecto), edita cualquier nombre en la tabla y exporta:
   - **Descargar Paquete ZIP** *(recomendado y compatible con todos los navegadores, incluso offline)*.
   - **Guardar en Carpeta** *(disponible en Chrome/Edge sobre HTTPS o `localhost` mediante File System Access API)*.
   - **Descargar Sueltos**.

> **Privacidad garantizada:** La app incluye una política CSP (`connect-src 'none'`) y no realiza ninguna petición de red externa.

### Opción 2: Script Automático para Windows (`Renombrar_PDFs_Auto.bat`)

Pensado para entregas estilo Moodle (`<NombreEstudiante>_<ID>/archivo.pdf`):

1. Coloca `Renombrar_PDFs_Auto.bat` en la misma carpeta donde descargaste uno o varios `.zip`.
2. Haz doble clic sobre el archivo `.bat`.
   *(Si Windows SmartScreen muestra un aviso por archivo descargado de internet, haz clic en **Más información → Ejecutar de todas formas**).*
3. Creará una carpeta `PDFs_<NombreDelZip>` (sin sobrescribir carpetas previas si ya existen) y la abrirá automáticamente en el Explorador.

---

## Seguridad y pruebas

- Protección contra **Zip Slip** (validación de ruta canónica y saneamiento de nombres de archivo/Windows reservados) y límites contra **Zip Bombs** tanto en el `.bat` como en la app web.
- Ejecutar pruebas unitarias (Node.js ≥ 18):
  ```bash
  node --test tests/renamer.test.mjs
  ```

---

## Licencia

Distribuido bajo licencia MIT. Consulta [LICENSE](LICENSE) para más detalles.
