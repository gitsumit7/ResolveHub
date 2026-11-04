# Resets the local PostgreSQL 18 "postgres" password for ResolveHub and creates supportiq_db.
# Must run as Administrator (the launch command below asks for it).
$pg          = 'C:\Program Files\PostgreSQL\18'
$hba         = "$pg\data\pg_hba.conf"
$backup      = "$hba.resolvehub.bak"
$svc         = 'postgresql-x64-18'
$newPassword = 'sumitji#835396'
$psql        = "$pg\bin\psql.exe"

Write-Host "1/5 Backing up pg_hba.conf"
Copy-Item $hba $backup -Force

try {
    Write-Host "2/5 Temporarily allowing local login without a password"
    (Get-Content $backup) -replace '(scram-sha-256|md5)\s*$', 'trust' | Set-Content $hba
    Restart-Service $svc -ErrorAction Stop
    Start-Sleep -Seconds 3

    Write-Host "3/5 Setting the new password for user postgres"
    & $psql -U postgres -h 127.0.0.1 -w -c "ALTER USER postgres PASSWORD '$newPassword';"
    if ($LASTEXITCODE -ne 0) { throw "ALTER USER failed" }

    Write-Host "4/5 Creating database supportiq_db (if it does not exist)"
    $exists = & $psql -U postgres -h 127.0.0.1 -w -tAc "SELECT 1 FROM pg_database WHERE datname = 'supportiq_db'"
    if ("$exists".Trim() -ne '1') {
        & $psql -U postgres -h 127.0.0.1 -w -c "CREATE DATABASE supportiq_db;"
    } else {
        Write-Host "    supportiq_db already exists"
    }
    $ok = $true
}
catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    $ok = $false
}
finally {
    Write-Host "5/5 Restoring password protection"
    Copy-Item $backup $hba -Force
    Restart-Service $svc
}

if ($ok) {
    Write-Host ""
    Write-Host "DONE - PostgreSQL password is now: $newPassword" -ForegroundColor Green
    Write-Host "You can close this window and run 'npm run db:init' in the backend folder."
}
