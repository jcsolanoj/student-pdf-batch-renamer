<# :
@echo off
chcp 65001 >nul
title Extractor y Renombrador de PDFs de Estudiantes
set "BAT_PATH=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ([System.IO.File]::ReadAllText($env:BAT_PATH, [System.Text.Encoding]::UTF8))"
exit /b %ERRORLEVEL%
#>

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.IO.Compression.FileSystem

$MAX_FILE_BYTES = 100MB
$MAX_TOTAL_BYTES = 2GB
$RESERVED_NAMES = @('CON','PRN','AUX','NUL','COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9','LPT1','LPT2','LPT3','LPT4','LPT5','LPT6','LPT7','LPT8','LPT9')

function Sanitize-FileName([string]$name) {
    if ([string]::IsNullOrWhiteSpace($name)) { return "Sin_Nombre" }
    $invalid = [System.IO.Path]::GetInvalidFileNameChars()
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $name.ToCharArray()) {
        if ($invalid -notcontains $ch -and $ch -ne '/' -and $ch -ne '\') {
            [void]$sb.Append($ch)
        }
    }
    $clean = ($sb.ToString() -replace '\.\.+', '_' -replace '\s+', ' ').Trim(' ', '.')
    if ([string]::IsNullOrWhiteSpace($clean)) { $clean = "Sin_Nombre" }
    if ($RESERVED_NAMES -contains $clean.ToUpperInvariant()) { $clean = "_$clean" }
    return $clean
}

function Get-UniqueDir([string]$baseDir) {
    if (-not (Test-Path -LiteralPath $baseDir)) { return $baseDir }
    $counter = 2
    while ($true) {
        $cand = "${baseDir}_${counter}"
        if (-not (Test-Path -LiteralPath $cand)) { return $cand }
        $counter++
    }
}

$workDir = Split-Path -Parent $env:BAT_PATH
$zips = Get-ChildItem -LiteralPath $workDir -Filter "*.zip" -File

if ($zips.Count -eq 0) {
    Write-Host "`n[AVISO] No se encontraron archivos .zip en esta carpeta." -ForegroundColor Yellow
    Write-Host "Coloca este script junto al archivo .zip descargado de Moodle/Canvas/Teams."
    Pause
    exit 0
}

foreach ($zipFile in $zips) {
    Write-Host "`n==========================================" -ForegroundColor Cyan
    Write-Host "Procesando: $($zipFile.Name)" -ForegroundColor Cyan
    $baseOut = Join-Path $workDir ("PDFs_" + (Sanitize-FileName $zipFile.BaseName))
    $outDir = Get-UniqueDir $baseOut
    New-Item -ItemType Directory -LiteralPath $outDir -Force | Out-Null
    $fullOutDir = [System.IO.Path]::GetFullPath($outDir) + [System.IO.Path]::DirectorySeparatorChar

    $counts = @{}
    $extracted = 0
    $skippedNonPdf = 0
    $totalBytes = [int64]0
    $zip = $null

    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($zipFile.FullName)
        foreach ($entry in $zip.Entries) {
            if ([string]::IsNullOrEmpty($entry.Name)) { continue }
            if ($entry.FullName -match '(^|[\\/])__MACOSX([\\/]|$)') { continue }

            if (-not $entry.Name.EndsWith(".pdf", [System.StringComparison]::OrdinalIgnoreCase)) {
                $skippedNonPdf++
                continue
            }

            if ($entry.Length -gt $MAX_FILE_BYTES) {
                Write-Host "  [OMITIDO - excede 100MB] $($entry.FullName)" -ForegroundColor Yellow
                continue
            }
            $totalBytes += $entry.Length
            if ($totalBytes -gt $MAX_TOTAL_BYTES) {
                throw "Se superó el límite de seguridad de 2 GB descomprimidos."
            }

            $parts = $entry.FullName.Split([char[]]@('/', '\'), [System.StringSplitOptions]::RemoveEmptyEntries)
            if ($parts.Length -ge 2) {
                $rawFolder = $parts[0]
                $rawName = $rawFolder.Split('_')[0]
            } else {
                $rawName = [System.IO.Path]::GetFileNameWithoutExtension($entry.Name)
            }

            $studentName = Sanitize-FileName $rawName
            $key = $studentName.ToLowerInvariant()
            if (-not $counts.ContainsKey($key)) { $counts[$key] = 0 }
            $counts[$key]++

            $suffix = if ($counts[$key] -eq 1) { "" } else { "_$($counts[$key])" }
            $destName = "$studentName$suffix.pdf"
            $destPath = Join-Path $outDir $destName

            while (Test-Path -LiteralPath $destPath) {
                $counts[$key]++
                $destName = "$studentName`_$($counts[$key]).pdf"
                $destPath = Join-Path $outDir $destName
            }

            $fullDest = [System.IO.Path]::GetFullPath($destPath)
            if (-not $fullDest.StartsWith($fullOutDir, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "Ruta insegura detectada (Zip Slip): $($entry.FullName)"
            }

            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destPath, $false)
            $extracted++
        }

        Write-Host "[OK] PDFs extraídos: $extracted (no-PDF omitidos: $skippedNonPdf)" -ForegroundColor Green
        Write-Host "Carpeta de salida: $outDir" -ForegroundColor Green
        if ($extracted -eq 0) {
            Write-Host "[AVISO] No se encontraron archivos .pdf dentro del ZIP." -ForegroundColor Yellow
            Pause
        } else {
            Invoke-Item -LiteralPath $outDir
        }
    } catch {
        Write-Host "[ERROR] Fallo al procesar $($zipFile.Name): $_" -ForegroundColor Red
        Pause
    } finally {
        if ($null -ne $zip) { $zip.Dispose() }
    }
}
