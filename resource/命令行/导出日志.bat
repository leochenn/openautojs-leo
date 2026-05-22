@echo off
setlocal

set "DEVICE_DIR=/sdcard/OpenAutoJS_NanjingBooking"
set "LOCAL_DIR=E:\leo-github\openautojs-leo\resource\log"

set "LATEST="
for /f "tokens=1" %%d in ('adb shell ls -t %DEVICE_DIR% ^| findstr "^[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]$"') do (
    if not defined LATEST set "LATEST=%%d"
)

if not defined LATEST (
    echo No run directory found
    pause
    exit /b 1
)

echo Latest run dir: %LATEST%
mkdir "%LOCAL_DIR%\%LATEST%" 2>nul
adb pull "%DEVICE_DIR%/%LATEST%/." "%LOCAL_DIR%\%LATEST%"
echo Exported to: %LOCAL_DIR%\%LATEST%
pause
