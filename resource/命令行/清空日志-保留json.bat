adb shell "find /sdcard/OpenAutoJS_NanjingBooking -type f ! -name '*.json' -exec rm -f {} +"
adb shell "find /sdcard/OpenAutoJS_NanjingBooking -mindepth 1 -type d -empty -delete"
pause
