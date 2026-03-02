document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('excelFile');
    const fileName = document.getElementById('fileName');
    const form = document.getElementById('automationForm');
    const statusMessage = document.getElementById('statusMessage');
    const submitBtn = document.getElementById('submitBtn');

    // Drag and Drop Logic
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            handleFile(fileInput.files[0]);
        }
    });

    function handleFile(file) {
        if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
            fileName.textContent = file.name;
            // You might want to assign fileInput.files here if drag/drop, 
            // but for simple visual feedback logic is enough. 
            // For actual submit we need FormData.
            window.selectedFile = file;
        } else {
            alert('Lütfen geçerli bir Excel dosyası yükleyin (.xls veya .xlsx)');
        }
    }

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const sipNo = document.getElementById('sipNo').value;
        const renk = document.getElementById('renk').value;
        const printType = document.querySelector('input[name="printType"]:checked').value;

        const file = fileInput.files[0] || window.selectedFile;

        if (!file) {
            alert('Lütfen bir Excel dosyası seçin.');
            return;
        }

        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
        statusMessage.style.display = 'block';

        const formData = new FormData();
        formData.append('sipNo', sipNo);
        formData.append('renk', renk);
        formData.append('printType', printType);
        formData.append('excelFile', file);

        try {
            // Github Pages (HTTPS) blocks HTTP (Localhost) requests by default (Mixed Content).
            // Users might need to allow insecure content or run chrome with --allow-running-insecure-content
            // OR deploy the backend to an HTTPS server (e.g. Azure, AWS, Heroku)

            const API_BASE_URL = 'http://localhost:5029';

            const response = await fetch(`${API_BASE_URL}/api/defacto/process`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Sunucu hatası');
            }

            const result = await response.json();
            alert('İşlem Başarılı! \n' + (result.message || 'Dosya işlendi ve yazdırıldı.'));

        } catch (error) {
            console.error('Error:', error);
            alert('Hata oluştu: ' + error.message);
        } finally {
            // Reset state
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-gear"></i> Hesapla ve Yazdır';
            statusMessage.style.display = 'none';
        }
    });
});
