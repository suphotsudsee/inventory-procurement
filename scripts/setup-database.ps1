# PowerShell script to create inventory database
# Run this script to set up the database

$mysqlPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
$sqlFile = "C:\fullstack\inventory-procurement\scripts\create-inventory-db.sql"

# Check if MySQL exists at default path
if (Test-Path $mysqlPath) {
    Write-Host "Creating inventory_db database..." -ForegroundColor Cyan
    & $mysqlPath -h localhost -P 3306 -u root -p12345678 < $sqlFile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database created successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create database. Please check MySQL connection." -ForegroundColor Red
    }
} else {
    Write-Host "MySQL not found at default location. Please run manually:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "mysql -h localhost -P 3306 -u root -p12345678 < C:\fullstack\inventory-procurement\scripts\create-inventory-db.sql" -ForegroundColor White
    Write-Host ""
    Write-Host "Or update the mysqlPath variable in this script to your MySQL installation path." -ForegroundColor Yellow
}
