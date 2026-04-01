@echo off
setlocal enabledelayedexpansion

REM === E-Tax Center Daily Database Backup ===
REM Schedule this in Windows Task Scheduler at midnight
REM Action: Start a program
REM Program: C:\path\to\this\daily-backup-deepmain.bat

REM --- Configuration ---
set PGHOST=localhost
set PGPORT=5432
set PGDATABASE=etax-production
set PGUSER=etaxusr
set PGPASSWORD=YOUR_PASSWORD_HERE

set BACKUP_DIR=D:\db-backups\etax
set PG_BIN=C:\Program Files\PostgreSQL\17\bin
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
set FILENAME=etax-production_%DATESTR%_%TIMESTR%.sql.gz
set LOGFILE=%BACKUP_DIR%\backup.log

REM --- Run backup ---
echo [%date% %time%] Starting backup... >> "%LOGFILE%"

"%PG_BIN%\pg_dump" -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -F c -Z 6 -f "%BACKUP_DIR%\%FILENAME%"

if %ERRORLEVEL% EQU 0 (
    for %%A in ("%BACKUP_DIR%\%FILENAME%") do set FILESIZE=%%~zA
    echo [%date% %time%] OK - %FILENAME% (!FILESIZE! bytes) >> "%LOGFILE%"
) else (
    echo [%date% %time%] FAILED - pg_dump error code %ERRORLEVEL% >> "%LOGFILE%"
    exit /b 1
)

REM --- Delete backups older than KEEP_DAYS ---
forfiles /p "%BACKUP_DIR%" /m "etax-production_*.sql.gz" /d -%KEEP_DAYS% /c "cmd /c del @path && echo [%date% %time%] Deleted old: @file >> \"%LOGFILE%\"" 2>nul

echo [%date% %time%] Backup complete >> "%LOGFILE%"
exit /b 0
