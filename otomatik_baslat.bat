@echo off
chcp 65001 >nul
:: "FatihSahinPortal" adli ana calistirici

:: Klasor Yollari
set "GRAFYX_DIR=C:\Users\grafik2\Desktop\Yeni klasör\GrafyxServer"
set "OCR_DIR=C:\Users\grafik2\Desktop\Yeni klasör\FatihSahinWebsite\backend"

:: 1. C# (GrafyxServer) Baslat
cd /d "%GRAFYX_DIR%"
start "GrafyxServer_Hidden" /MIN dotnet run

:: 2. Python (OCR) Baslat
cd /d "%OCR_DIR%"
start "OCRServer_Hidden" /MIN python main.py

:: 3. Tarayici acilmadan once API'lerin hazir olmasi icin kisa bekleme
timeout /t 5 >nul

:: 4. Tarayiciyi App modunda (tam pencere, sekmesiz) ac.
:: Dosya yolunu Turkce karakter ve bosluklari (% isareti ciftlenmis halde) kodlanmis URI olarak veriyoruz.
start msedge.exe --app="file:///C:/Users/grafik2/Desktop/Yeni%%20klas%%C3%%B6r/FatihSahinWebsite/index.html"

:: 5. Kapanmayi gozle. Edge/Chrome uygulama kapanana kadar dongu
:LOOP
timeout /t 3 >nul

:: Baslikta "Fatih" gecen msedge var mi kontrol et. Eger kapandiysa ERRORLEVEL 1 doner.
tasklist /FI "WINDOWTITLE eq Fatih*" /FI "IMAGENAME eq msedge.exe" 2>NUL | find /I "msedge.exe" >NUL
if "%ERRORLEVEL%"=="0" goto LOOP

:: Google Chrome kullanildiysa onun icin de kontrol:
tasklist /FI "WINDOWTITLE eq Fatih*" /FI "IMAGENAME eq chrome.exe" 2>NUL | find /I "chrome.exe" >NUL
if "%ERRORLEVEL%"=="0" goto LOOP

:: -- Eger buraya gelinmisse tarayici kapatilmis demektir. --
echo "Uygulama kapatildi, sunucular durduruluyor..."

:: 5029 (C#) portunu kullanan PID bul ve oldur
FOR /F "tokens=5" %%a IN ('netstat -aon ^| findstr "0.0.0.0:5029"') DO (
    taskkill /F /PID %%a 2>nul
)

:: 5000 (Python) portunu kullanan PID bul ve oldur
FOR /F "tokens=5" %%a IN ('netstat -aon ^| findstr "0.0.0.0:5000"') DO (
    taskkill /F /PID %%a 2>nul
)

:: Console pencerelerini kapat
taskkill /FI "WINDOWTITLE eq GrafyxServer_Hidden*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq OCRServer_Hidden*" /F >nul 2>&1

exit
