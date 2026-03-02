document.addEventListener('DOMContentLoaded', () => {
    console.log("Fatih Şahin Website Loaded");

    // Modal Logic
    const infoBtn = document.getElementById('infoBtn');
    const aboutModal = document.getElementById('aboutModal');
    const closeModalBtn = document.getElementById('closeModalBtn');

    if (infoBtn && aboutModal) {
        infoBtn.addEventListener('click', () => {
            aboutModal.classList.remove('hidden');
        });

        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                aboutModal.classList.add('hidden');
            });
        }

        // Close on clicking outside
        aboutModal.addEventListener('click', (e) => {
            if (e.target === aboutModal) {
                aboutModal.classList.add('hidden');
            }
        });

        // Close on ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !aboutModal.classList.contains('hidden')) {
                aboutModal.classList.add('hidden');
            }
        });
    }
    // --- OCR Feature Logic ---
    const openOcrBtn = document.getElementById('openOcrBtn');
    const ocrModal = document.getElementById('ocrModal');
    const closeOcrModalBtn = document.getElementById('closeOcrModalBtn');
    const ocrInput = document.getElementById('ocrInput');
    const fileNameDisplay = document.getElementById('fileName');
    const previewContainer = document.getElementById('previewContainer');
    const ocrPreview = document.getElementById('ocrPreview');
    const startOcrBtn = document.getElementById('startOcrBtn');
    const ocrLoading = document.getElementById('ocrLoading');
    const ocrStatus = document.getElementById('ocrStatus');
    const resultSection = document.getElementById('resultSection');
    const ocrResult = document.getElementById('ocrResult');
    const copyOcrBtn = document.getElementById('copyOcrBtn');

    if (openOcrBtn && ocrModal) {
        // Open Modal
        openOcrBtn.addEventListener('click', () => {
            ocrModal.classList.remove('hidden');
        });

        // Close Modal
        if (closeOcrModalBtn) {
            closeOcrModalBtn.addEventListener('click', () => {
                ocrModal.classList.add('hidden');
                resetOcrState();
            });
        }

        // Close on outside click
        ocrModal.addEventListener('click', (e) => {
            if (e.target === ocrModal) {
                ocrModal.classList.add('hidden');
                resetOcrState();
            }
        });

        // Handle File Selection (Input)
        ocrInput.addEventListener('change', (e) => {
            handleFile(e.target.files[0]);
        });

        // Drag and Drop Logic
        const dropZone = document.getElementById('dropZone');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });

        function highlight(e) {
            dropZone.classList.add('dragover');
        }

        function unhighlight(e) {
            dropZone.classList.remove('dragover');
        }

        dropZone.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFile(files[0]);
        }

        let selectedFile = null;

        function handleFile(file) {
            if (file && file.type.startsWith('image/')) {
                selectedFile = file;
                fileNameDisplay.textContent = file.name;
                const reader = new FileReader();
                reader.onload = (e) => {
                    ocrPreview.src = e.target.result;
                    previewContainer.classList.remove('hidden');
                    startOcrBtn.disabled = false;
                    resultSection.classList.add('hidden');
                };
                reader.readAsDataURL(file);
            }
        }

        // Preprocessing Function for Better OCR
        function preprocessImage(file) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const scaleFactor = 2.5; // Upscale for better detail recognition
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Add padding to avoid edge artifacts
                    const padding = 20;
                    canvas.width = (img.width * scaleFactor) + (padding * 2);
                    canvas.height = (img.height * scaleFactor) + (padding * 2);

                    // Fill white background first
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    // High quality scaling
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, padding, padding, img.width * scaleFactor, img.height * scaleFactor);

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;

                    // Binarization Threshold
                    // Pixels darker than this become black, lighter become white
                    const threshold = 180;

                    for (let i = 0; i < data.length; i += 4) {
                        // Grayscale (Luma coding)
                        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

                        // Binarize
                        const value = gray < threshold ? 0 : 255;

                        data[i] = value;     // R
                        data[i + 1] = value; // G
                        data[i + 2] = value; // B
                        // Alpha remains unchanged at 255
                    }

                    ctx.putImageData(imageData, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = (error) => reject(error);
                img.src = URL.createObjectURL(file);
            });
        }

        // Start OCR Process
        startOcrBtn.addEventListener('click', async () => {
            if (!selectedFile) return;

            // UI Updates
            startOcrBtn.disabled = true;
            ocrLoading.classList.remove('hidden');
            resultSection.classList.add('hidden');
            ocrStatus.textContent = "Görsel iyileştiriliyor..."; // Updating status

            try {
                // 1. Preprocess Image
                const processedImageUrl = await preprocessImage(selectedFile);

                // 2. Initialize Worker
                const worker = await Tesseract.createWorker('tur+eng+ara+rus');

                ocrStatus.textContent = "Metin taranıyor...";

                // 3. Recognize from Processed Image
                const { data: { text } } = await worker.recognize(processedImageUrl);

                // Post-processing to fix common OCR errors
                // Fix: '©' -> 'C'
                let processedText = text.replace(/©/g, 'C');
                // Fix: Common number confusions could be addressed here if patterns persist,
                // but graphical preprocessing usually solves 3 vs 5 better than regex.

                await worker.terminate();

                // Show Results
                ocrResult.value = processedText;
                resultSection.classList.remove('hidden');
                ocrStatus.textContent = "Tamamlandı!";
            } catch (error) {
                console.error(error);
                ocrStatus.textContent = "Hata oluştu: " + error.message;
            } finally {
                ocrLoading.classList.add('hidden');
                startOcrBtn.disabled = false;
            }
        });

        // Copy to Clipboard
        copyOcrBtn.addEventListener('click', () => {
            ocrResult.select();
            document.execCommand('copy');

            const originalText = copyOcrBtn.innerHTML;
            copyOcrBtn.innerHTML = '<i class="fa-solid fa-check"></i> Kopyalandı';
            setTimeout(() => {
                copyOcrBtn.innerHTML = originalText;
            }, 2000);
        });

        function resetOcrState() {
            // Optional: Clear form if needed, but keeping state might be better for UX
            // ocrInput.value = '';
            // previewContainer.classList.add('hidden');
            // resultSection.classList.add('hidden');
            // fileNameDisplay.textContent = '';
        }

        // Paste Event Listener
        document.addEventListener('paste', (e) => {
            if (ocrModal.classList.contains('hidden')) return;

            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let index in items) {
                const item = items[index];
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    const blob = item.getAsFile();
                    handleFile(blob);
                    e.preventDefault(); // Prevent default paste behavior
                }
            }
        });
    }

    // --- PDF İşlemleri Logic ---
    const openPdfBtn = document.getElementById('openPdfBtn');
    const pdfModal = document.getElementById('pdfModal');
    const closePdfModalBtn = document.getElementById('closePdfModalBtn');
    const pdfInput = document.getElementById('pdfInput');
    const pdfDropZone = document.getElementById('pdfDropZone');
    const pdfFileNameDisplay = document.getElementById('pdfFileName');
    const splitPdfActionBtn = document.getElementById('splitPdfActionBtn');

    if (openPdfBtn && pdfModal) {
        // Open Modal
        openPdfBtn.addEventListener('click', () => {
            pdfModal.classList.remove('hidden');
        });

        // Close Modal
        if (closePdfModalBtn) {
            closePdfModalBtn.addEventListener('click', () => {
                pdfModal.classList.add('hidden');
                resetPdfState();
            });
        }

        // Close on outside click
        pdfModal.addEventListener('click', (e) => {
            if (e.target === pdfModal) {
                pdfModal.classList.add('hidden');
                resetPdfState();
            }
        });

        // File Selection (Input)
        pdfInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handlePdfFileSelection(e.target.files[0]);
            }
        });

        // Drag and Drop Logic for PDF
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            pdfDropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            pdfDropZone.addEventListener(eventName, () => {
                pdfDropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            pdfDropZone.addEventListener(eventName, () => {
                pdfDropZone.classList.remove('dragover');
            }, false);
        });

        pdfDropZone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files.length) {
                handlePdfFileSelection(e.dataTransfer.files[0]);
            }
        }, false);

        // Paste Logic for PDF
        document.addEventListener('paste', (e) => {
            if (pdfModal.classList.contains('hidden')) return;

            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let index in items) {
                const item = items[index];
                if (item.kind === 'file' && item.type === 'application/pdf') {
                    const file = item.getAsFile();
                    handlePdfFileSelection(file);
                    e.preventDefault();
                }
            }
        });

        let selectedPdfFile = null;

        function handlePdfFileSelection(file) {
            if (file && file.type === 'application/pdf') {
                selectedPdfFile = file;
                pdfFileNameDisplay.textContent = `Seçilen: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
                splitPdfActionBtn.disabled = false;
            } else {
                alert('Lütfen sadece PDF formatında bir dosya seçin.');
            }
        }

        function resetPdfState() {
            // Uncomment if you want the PDF selection to clear every time it's closed:
            // selectedPdfFile = null;
            // pdfInput.value = '';
            // pdfFileNameDisplay.textContent = '';
            // splitPdfActionBtn.disabled = true;
        }

        // Split Action via Backend Server
        splitPdfActionBtn.addEventListener('click', async () => {
            if (!selectedPdfFile) return;

            try {
                splitPdfActionBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dosya Sunucuya Gönderiliyor...';
                splitPdfActionBtn.disabled = true;

                const formData = new FormData();
                formData.append('file', selectedPdfFile);

                // Assuming GrafyxServer is running on its default local endpoint
                const response = await fetch('https://stepanie-indistinct-semiexternally.ngrok-free.dev/api/pdf/split', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    let errorMessage = "Bilinmeyen Sunucu Hatası";
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.message || response.statusText;
                        if (errorData.details) errorMessage += "\n\nEk Detay: " + errorData.details;
                    } catch (e) {
                        errorMessage = await response.text();
                    }
                    throw new Error(errorMessage);
                }

                const result = await response.json();

                if (result.success) {
                    alert(`İşlem Tamamlandı!\n\n${result.message}`);

                    // İşlem bittikten sonra formu temizleyebiliriz
                    // pdfModal.classList.add('hidden');
                    // resetPdfState();
                } else {
                    alert('Hata: ' + result.message);
                }

            } catch (error) {
                console.error('PDF bölme hatası:', error);
                alert('İşlem sırasında bir bağlantı hatası oluştu. Lütfen arka planda "GrafyxServer" uygulamasının çalıştığından emin olun.\n\nDetay: ' + error.message);
            } finally {
                splitPdfActionBtn.innerHTML = '<i class="fa-solid fa-scissors"></i> PDF Böl';
                splitPdfActionBtn.disabled = false;
            }
        });

        function downloadBlob(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }
});
