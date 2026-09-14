param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$resolved = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolved | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $resolved "supabase-$stamp.sql"
supabase db dump --linked --file $target
if ($LASTEXITCODE -ne 0) { throw "Supabase database backup failed" }
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $target).Hash
Set-Content -LiteralPath "$target.sha256" -Value "$hash  $([System.IO.Path]::GetFileName($target))"
Write-Output $target
