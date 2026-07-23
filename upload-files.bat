@echo off
echo 🚀 File Upload to Server
echo ========================
echo.

echo 📁 Checking for uploads directory...
if not exist "uploads" (
    echo ❌ Uploads directory not found!
    echo 📁 Creating uploads directory structure...
    mkdir uploads
    mkdir uploads\daive-audio
    mkdir uploads\daive-audio\greeting
    mkdir uploads\daive-audio\response
    mkdir uploads\vehicle-photos
    mkdir uploads\vehicle-images
    mkdir uploads\etl-documents
    mkdir uploads\temp
    echo ✅ Created uploads directory structure
    echo.
    echo 📝 Please add your files to the appropriate subdirectories:
    echo    - uploads\daive-audio\greeting\     (for greeting audio files)
    echo    - uploads\daive-audio\response\     (for response audio files)
    echo    - uploads\vehicle-photos\           (for vehicle images)
    echo    - uploads\etl-documents\            (for CSV/PDF files)
    echo.
    pause
    exit /b
)

echo ✅ Uploads directory found
echo.
echo 📋 Available files to upload:
echo.

for /r "uploads" %%f in (*) do (
    if not "%%~dpf"=="uploads\" (
        echo 📁 %%~dpf
        echo    📄 %%~nxf
    )
)

echo.
echo 🔧 To upload files, you have several options:
echo.
echo 1️⃣  Use the Node.js script:
echo    npm install form-data axios
echo    node upload-files-to-server.js
echo.
echo 2️⃣  Use the test interface:
echo    Open test-inspection.html in your browser
echo.
echo 3️⃣  Manual upload via Render.com Shell:
echo    - Go to Render.com Shell
echo    - Navigate to your uploads directory
echo    - Copy files manually
echo.
echo 4️⃣  Use FTP/SFTP client:
echo    - Connect to your server
echo    - Upload files to uploads/ directories
echo.
echo 📚 For more help, run: node upload-files-to-server.js --help
echo.
pause
