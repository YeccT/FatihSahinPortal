@echo off
chcp 65001 >nul
echo ---------------------------------------------------
echo  FATIH SAHIN WEBSITE - YEREL SUNUCU BASLATICI
echo ---------------------------------------------------
echo.

echo 1. GrafyxServer (C#) baslatiliyor...
start "Grafyx Server (Defacto)" /D "C:\Users\grafik2\Desktop\Yeni klasör\GrafyxServer" dotnet run

echo 2. OCR Server (Python) baslatiliyor...
start "OCR Server (Python)" /D "C:\Users\grafik2\Desktop\Yeni klasör\FatihSahinWebsite\backend" python main.py

echo.
echo Sunucular arka planda aciliyor (ilk acilis 5-10 saniye surebilir).
echo Lutfen acilan siyah ekranlari KAPATMAYIN.
echo.
echo 3. Web sitesi aciliyor...
timeout /t 5 >nul
start "" "C:\Users\grafik2\Desktop\Yeni klasör\FatihSahinWebsite\index.html"

echo.
echo Islem tamam! Keyifli kullanimlar.
echo Cikmak icin bu pencereyi kapatabilirsiniz.
pause >nul
