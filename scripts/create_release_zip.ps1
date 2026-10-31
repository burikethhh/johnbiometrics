$ErrorActionPreference = "Stop"

$baseDir = "B:\Projects\GreenValley"
$releaseDir = Join-Path $baseDir "_release\FingerGate"
$zipPath = Join-Path $baseDir "FingerGate_Local_Release.zip"

Write-Host "Creating clean staging folder at $releaseDir..."
if (Test-Path $releaseDir) { Remove-Item -Recurse -Force $releaseDir }
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

Write-Host "1. Copying root files..."
Copy-Item (Join-Path $baseDir "HOW_TO_RUN_LOCALLY.txt") $releaseDir
Copy-Item (Join-Path $baseDir "TRANSFER_GUIDE.md") $releaseDir
Copy-Item (Join-Path $baseDir "README.md") $releaseDir
Copy-Item (Join-Path $baseDir "package.json") $releaseDir
Copy-Item (Join-Path $baseDir "start-fingergate.bat") $releaseDir
Copy-Item (Join-Path $baseDir "stop-fingergate.bat") $releaseDir

Write-Host "2. Copying database dump..."
$dbDir = Join-Path $releaseDir "database"
New-Item -ItemType Directory -Force -Path $dbDir | Out-Null
Copy-Item (Join-Path $baseDir "database\fingergate_export.sql") $dbDir

Write-Host "3. Copying helper scripts..."
$scriptsDir = Join-Path $releaseDir "scripts"
New-Item -ItemType Directory -Force -Path $scriptsDir | Out-Null
Copy-Item (Join-Path $baseDir "scripts\dump_db.js") $scriptsDir
Copy-Item (Join-Path $baseDir "scripts\zk_terminal_sync.js") $scriptsDir

Write-Host "4. Copying backend (source + node_modules)..."
$beDir = Join-Path $releaseDir "backend"
New-Item -ItemType Directory -Force -Path $beDir | Out-Null
Copy-Item (Join-Path $baseDir "backend\src") (Join-Path $beDir "src") -Recurse
Copy-Item (Join-Path $baseDir "backend\server.js") $beDir
Copy-Item (Join-Path $baseDir "backend\package.json") $beDir
Copy-Item (Join-Path $baseDir "backend\package-lock.json") $beDir
Copy-Item (Join-Path $baseDir "backend\.env.example") $beDir
Copy-Item (Join-Path $baseDir "backend\.env") $beDir
Copy-Item (Join-Path $baseDir "backend\node_modules") (Join-Path $beDir "node_modules") -Recurse

Write-Host "5. Copying frontend (source + pre-compiled production build)..."
$feDir = Join-Path $releaseDir "frontend"
New-Item -ItemType Directory -Force -Path $feDir | Out-Null
Copy-Item (Join-Path $baseDir "frontend\src") (Join-Path $feDir "src") -Recurse
Copy-Item (Join-Path $baseDir "frontend\public") (Join-Path $feDir "public") -Recurse
Copy-Item (Join-Path $baseDir "frontend\build") (Join-Path $feDir "build") -Recurse
Copy-Item (Join-Path $baseDir "frontend\package.json") $feDir
Copy-Item (Join-Path $baseDir "frontend\package-lock.json") $feDir

Write-Host "6. Compressing into $zipPath..."
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path "$releaseDir\*" -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "7. Cleaning up temporary staging directory..."
Remove-Item -Recurse -Force (Join-Path $baseDir "_release")

$sizeMB = (Get-Item $zipPath).Length / 1MB
Write-Host ("`nSUCCESS! Portable ZIP created: " + $zipPath + " (" + [math]::Round($sizeMB, 2) + " MB)")

