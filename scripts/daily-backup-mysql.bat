@echo off
setlocal enabledelayedexpansion

REM === MySQL 8 Daily Database Backup ===
REM Schedule this in Windows Task Scheduler at midnight
REM Action: Start a program
REM Program: C:\path\to\this\daily-backup-mysql.bat

REM --- Configuration ---
set MYSQL_HOST=localhost
set MYSQL_PORT=3306
set MYSQL_DATABASE=YOUR_DATABASE_NAME
set MYSQL_USER=root
set MYSQL_PASSWORD=YOUR_PASSWORD_HERE

set BACKUP_DIR=D:\db-backups\mysql
set MYSQL_BIN=C:\Program Files\MySQL\MySQL Server 8.0\bin
set KEEP_DAYS=30

REM --- Create backup directory if not exists ---
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM --- Generate filename with date ---
for /f "tokens=1-3 delims=/" %%a in ('echo %date%') do (
    set DATESTR=%%c-%%a-%%b
)
for /f "tokens=1-2 delims=:" %%a in ('echo %time: =0%') do (
    set TIMESTR=%%a%%b
)
set FILENAME=%MYSQL_DATABASE%_%DATESTR%_%TIMESTR%.sql
set LOGFILE=%BACKUP_DIR%\backup.log

REM --- Run backup ---
echo [%date% %time%] Starting MySQL backup... >> "%LOGFILE%"

"%MYSQL_BIN%\mysqldump" --host=%MYSQL_HOST% --port=%MYSQL_PORT% --user=%MYSQL_USER% --password=%MYSQL_PASSWORD% --single-transaction --routines --triggers --events --set-gtid-purged=OFF --column-statistics=0 %MYSQL_DATABASE% > "%BACKUP_DIR%\%FILENAME%"

if %ERRORLEVEL% EQU 0 (
    for %%A in ("%BACKUP_DIR%\%FILENAME%") do set FILESIZE=%%~zA
    echo [%date% %time%] OK - %FILENAME% (!FILESIZE! bytes) >> "%LOGFILE%"
) else (
    echo [%date% %time%] FAILED - mysqldump error code %ERRORLEVEL% >> "%LOGFILE%"
    exit /b 1
)

REM --- Delete backups older than KEEP_DAYS ---
forfiles /p "%BACKUP_DIR%" /m "%MYSQL_DATABASE%_*.sql" /d -%KEEP_DAYS% /c "cmd /c del @path && echo [%date% %time%] Deleted old: @file >> \"%LOGFILE%\"" 2>nul

echo [%date% %time%] Backup complete >> "%LOGFILE%"
exit /b 0
