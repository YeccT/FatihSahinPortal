document.addEventListener('DOMContentLoaded', () => {
    const sizesList = document.getElementById('sizesList');
    const addSizeBtn = document.getElementById('addSizeBtn');
    const calculateBtn = document.getElementById('calculateBtn');
    const resultsSection = document.getElementById('resultsSection');
    const resultsContainer = document.getElementById('resultsContainer');
    const sizeRowTemplate = document.getElementById('sizeRowTemplate');
    const exportBtn = document.getElementById('exportBtn');
    let currentStrategy = null;
    let calculatedItems = [];

    // Add initial row
    addSizeRow();

    // Event Listeners
    addSizeBtn.addEventListener('click', addSizeRow);
    calculateBtn.addEventListener('click', calculate);
    if (exportBtn) exportBtn.addEventListener('click', exportToExcel);

    // Theme Switcher & Modal
    const themeToggle = document.getElementById('themeToggle');
    const html = document.documentElement;
    const icon = themeToggle.querySelector('i');

    function setTheme(isLight) {
        if (isLight) {
            html.setAttribute('data-theme', 'light');
            icon.className = 'fa-solid fa-moon';
        } else {
            html.removeAttribute('data-theme');
            icon.className = 'fa-solid fa-sun';
        }
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    }

    // Check Preference
    if (localStorage.getItem('theme') === 'light') {
        setTheme(true);
    }

    themeToggle.addEventListener('click', () => {
        const isLight = !html.hasAttribute('data-theme');
        setTheme(isLight);
    });

    // --- About Modal Logic ---
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

    function addSizeRow() {
        const clone = sizeRowTemplate.content.cloneNode(true);
        const removeBtn = clone.querySelector('.remove-row');

        removeBtn.addEventListener('click', (e) => {
            const row = e.target.closest('.size-row');
            if (sizesList.children.length > 1) {
                row.remove();
                updateTotalQty();
            } else {
                alert("En az bir beden olmalıdır.");
            }
        });

        sizesList.appendChild(clone);
        updateTotalQty(); // Update total when row added
    }

    // --- New Features: Total Qty & Tab Navigation ---

    // 1. Total Quantity Listener
    sizesList.addEventListener('input', (e) => {
        if (e.target.classList.contains('size-qty')) {
            updateTotalQty();
        }
    });

    // 2. Vertical Navigation (Enter & Tab)
    // User Request: Enter/Tab should move DOWN to the same column in the next row.
    // If at the last row, add a new row automatically.
    sizesList.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            const target = e.target;
            const isName = target.classList.contains('size-name');
            const isQty = target.classList.contains('size-qty');

            if (isName || isQty) {
                e.preventDefault(); // Stop default Tab behavior (horizontal) or Enter behavior

                const currentRow = target.closest('.size-row');
                let nextRow = currentRow.nextElementSibling;

                // Auto-add row if we are at the bottom AND (Enter OR Tab) is pressed
                if (!nextRow && (e.key === 'Enter' || e.key === 'Tab')) {
                    addSizeRow();
                    nextRow = sizesList.lastElementChild;
                }

                if (nextRow) {
                    const selector = isName ? '.size-name' : '.size-qty';
                    const nextInput = nextRow.querySelector(selector);
                    if (nextInput) {
                        nextInput.focus();
                    }
                }
            }
        }
    });

    function updateTotalQty() {
        const qtys = document.querySelectorAll('.size-qty');
        let total = 0;
        qtys.forEach(input => {
            const val = parseInt(input.value);
            if (!isNaN(val)) total += val;
        });
        const display = document.getElementById('totalQtyDisplay');
        if (display) display.textContent = total.toLocaleString();
    }

    async function calculate() {
        // Collect Inputs
        const totalSlots = parseInt(document.getElementById('totalSlots').value);
        if (isNaN(totalSlots) || totalSlots < 1) {
            alert("Lütfen geçerli bir bıçak sayısı girin.");
            return;
        }

        const sizeRows = document.querySelectorAll('.size-row');
        const items = [];
        let hasError = false;

        sizeRows.forEach(row => {
            const name = row.querySelector('.size-name').value.trim();
            const qtyVal = row.querySelector('.size-qty').value;
            const qty = parseInt(qtyVal);

            const isNameEmpty = name === '';
            const isQtyEmpty = !qtyVal; // Check if empty string

            // 1. Both Empty -> Remove from DOM and Skip
            if (isNameEmpty && isQtyEmpty) {
                // If it's not the only row, remove it
                if (sizeRows.length > 1) {
                    row.remove();
                }
                return;
            }

            // 2. Partial -> Error
            if (isNameEmpty || isQtyEmpty || isNaN(qty) || qty < 1) {
                hasError = true;
                // Optional: Highlight row visually (not requested but helpful)
                row.style.backgroundColor = '#fee2e2';
                setTimeout(() => row.style.backgroundColor = '', 2000);
            } else {
                // 3. Valid -> Add
                items.push({ name, qty, id: Math.random().toString(36).substr(2, 9) });
            }
        });

        if (hasError) {
            alert("Lütfen tüm beden ve adet bilgilerini eksiksiz doldurun.");
            return;
        }

        if (items.length === 0) {
            alert("Lütfen en az bir beden ekleyin.");
            return;
        }

        // Show loading state
        calculateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Hesaplanıyor...';
        calculateBtn.disabled = true;

        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            // Run Algorithm
            calculatedItems = items; // Store for export
            const strategy = findBestStrategy(totalSlots, items);
            currentStrategy = strategy; // Store for export
            displayResults(strategy);

            // Show Export Button if successful
            if (strategy && strategy.runs.length > 0 && exportBtn) {
                exportBtn.style.display = 'inline-flex';
            }
        } catch (e) {
            console.error(e);
            alert("Hesaplama sırasında bir hata oluştu.");
        } finally {
            calculateBtn.innerHTML = '<i class="fa-solid fa-calculator"></i> Hesapla';
            calculateBtn.disabled = false;
        }
    }

    // --- Core Algorithm (Optimized & Grouped) ---

    // Main Entry Point
    // Main Entry Point
    function findBestStrategy(N, items) {
        // 1. No Grouping by Quantity - Treat all as one pool to allow mixing different quantities
        // The solver itself will handle partitioning if needed to reduce huge waste.

        const strategy = solveForGroup(N, items);

        // Re-index runs for display
        strategy.runs.forEach((run, i) => run.index = i + 1);

        return {
            type: strategy.runs.length > 1 ? 'multi' : 'single',
            totalSheets: strategy.totalSheets,
            totalWaste: strategy.totalWaste,
            runs: strategy.runs
        };
    }

    // Solver for a set of items
    function solveForGroup(N, startItems) {
        // Pass N to generatePartitions for large group awareness
        const allPartitions = generatePartitions(startItems, N);

        let bestStrategy = {
            totalSheets: Infinity,
            totalWaste: Infinity,
            runs: []
        };

        // Penalty parameters
        let totalQty = 0;
        startItems.forEach(item => totalQty += item.qty);
        // User Request (New): 
        // If Total Qty > 3000 -> Prioritize Low Waste (Allow Splitting).
        // If Total Qty <= 3000 -> Prioritize Low Montage Count (Force Single).

        // 2% was too low (sized-based splitting). 4% was too high (no splitting).
        // 1.2% was too aggressive (caused 8 montages).
        // 3.5% was too conservative (high waste).
        // Trying 2.5% to find the balance (~3 montages).
        let penaltyFactor = (totalQty > 3000) ? 0.025 : 0.10;

        let penaltyPerMontage = Math.min(totalQty * penaltyFactor, 4000);
        if (penaltyPerMontage < 50) penaltyPerMontage = 50;

        for (const partition of allPartitions) {
            let currentStrategy = {
                totalSheets: 0,
                totalWaste: 0,
                runs: []
            };

            let possible = true;

            for (const group of partition) {
                const sol = solveSingleRun(N, group);
                if (!sol) {
                    possible = false;
                    break;
                }
                currentStrategy.totalSheets += sol.sheets;
                currentStrategy.totalWaste += sol.waste;
                currentStrategy.runs.push(sol);
            }

            if (possible) {
                // Scoring with Progressive Penalty (User Request: Max 4-5 runs)
                let runPenalty = currentStrategy.runs.length * penaltyPerMontage;

                // SOFT CAP: If runs > 4, apply massive penalty to discourage 6, 7, 8 runs
                // unless waste reduction is astronomical.
                if (currentStrategy.runs.length > 4) {
                    runPenalty += (currentStrategy.runs.length - 4) * (totalQty * 0.2); // 20% total qty penalty per extra run
                }

                const currentScore = currentStrategy.totalWaste + runPenalty;
                const bestRunPenalty = bestStrategy.runs.length * penaltyPerMontage + (bestStrategy.runs.length > 4 ? (bestStrategy.runs.length - 4) * (totalQty * 0.2) : 0);
                const bestScore = bestStrategy.totalWaste + bestRunPenalty;

                let isBetter = false;
                if (bestStrategy.totalSheets === Infinity) {
                    isBetter = true;
                } else if (currentScore < bestScore) {
                    isBetter = true;
                } else if (Math.abs(currentScore - bestScore) < 1) { // Tie
                    if (currentStrategy.totalSheets < bestStrategy.totalSheets) {
                        isBetter = true;
                    } else if (currentStrategy.totalSheets === bestStrategy.totalSheets) {
                        if (currentStrategy.totalWaste < bestStrategy.totalWaste) {
                            isBetter = true;
                        }
                    }
                }

                if (isBetter) {
                    bestStrategy = currentStrategy;
                }
            }
        }
        return bestStrategy;
    }

    function generatePartitions(items, N = 100) {
        // 1. Large Group Handling (> 9 items OR > N slots)
        // If items > N, we MUST chunk them or use singletons, because they won't fit in one run anyway.

        if (items.length > 9 || items.length > N) {
            const options = [];

            // OPTION 1: All items in ONE group (Only valid if k <= N)
            if (items.length <= N) {
                options.push([items]);
            }

            // OPTION 2: Chunking by N (Requested Logic for 15 items in 12 slots)
            if (items.length > N) {
                const chunks = [];
                for (let i = 0; i < items.length; i += N) {
                    chunks.push(items.slice(i, i + N));
                }
                options.push(chunks);
            }

            // OPTION 3: Split by Quantity Variance (NEW)
            // If items vary significantly (e.g. 400 vs 16), splitting them into 2 groups can save MASSIVE waste.
            if (items.length > 1) {
                const sorted = [...items].sort((a, b) => a.qty - b.qty);
                // 2. Try ALL Splits (Brute Force)
                // Instead of guessing, try splitting at every point.
                for (let i = 0; i < sorted.length - 1; i++) {
                    const group1 = sorted.slice(0, i + 1);
                    const group2 = sorted.slice(i + 1);
                    options.push([group1, group2]);
                }
            }

            // OPTION 3: Singletons (Safe Fallback)
            const singletons = items.map(i => [i]);
            options.push(singletons);

            return options;
        }

        if (items.length === 0) return [[]];

        const first = items[0];
        const rest = items.slice(1);
        const partsOfRest = generatePartitions(rest, N);
        const result = [];

        for (const p of partsOfRest) {
            result.push([[first], ...p]);
            for (let i = 0; i < p.length; i++) {
                if (p[i].length < 6) {
                    const newPartition = p.map((group, groupIndex) =>
                        groupIndex === i ? [first, ...group] : group
                    );
                    result.push(newPartition);
                }
            }
        }
        return result;
    }

    function solveSingleRun(N, items) {
        const k = items.length;
        if (N < k) return null;

        // Special Case: 1 Item
        if (k === 1) {
            const item = items[0];
            const usage = N;
            const sheets = Math.ceil(item.qty / usage);
            const produced = sheets * usage;
            const waste = produced - item.qty;
            return {
                items: items,
                distribution: [usage],
                sheets: sheets,
                produced: produced,
                waste: waste,
                wastePercent: (waste / item.qty) * 100
            };
        }

        // OPTIMIZATION: Identical Quantities (User Scenario: 17 items same qty)
        const referenceQty = items[0].qty;
        const allSameQty = items.every(i => i.qty === referenceQty);

        if (allSameQty) {
            const dist = new Array(k);
            const base = Math.floor(N / k);
            const remainder = N % k;

            // Distribute remainder to first 'remainder' items
            for (let i = 0; i < k; i++) {
                dist[i] = (i < remainder) ? base + 1 : base;
            }

            // Calculate Result directly
            let requiredSheets = 0;
            for (let i = 0; i < k; i++) {
                const s = Math.ceil(referenceQty / dist[i]);
                if (s > requiredSheets) requiredSheets = s;
            }

            let totalProduced = 0;
            let totalRequired = 0;
            let netWaste = 0;

            for (let i = 0; i < k; i++) {
                const produced = requiredSheets * dist[i];
                const required = items[i].qty;
                totalProduced += produced;
                totalRequired += required;
                netWaste += (produced - required);
            }

            return {
                items: items,
                distribution: dist,
                sheets: requiredSheets,
                produced: totalProduced,
                waste: netWaste,
                wastePercent: (netWaste / totalRequired) * 100
            };
        }

        let bestSol = null;

        // Recursive solver with Heuristic Optimization
        function generate(index, currentSum, currentDistribution) {
            if (index === k - 1) {
                const remainder = N - currentSum;
                if (remainder >= 1) {
                    currentDistribution[index] = remainder;
                    evaluate(currentDistribution);
                }
                return;
            }

            const remainingItems = k - (index + 1);
            const maxForThis = N - currentSum - remainingItems;

            let start = 1;
            let end = maxForThis;

            if (k > 3) {
                const item = items[index];
                let totalQty = 0;
                items.forEach(i => totalQty += i.qty);

                const ideal = (item.qty / totalQty) * N;
                const delta = Math.max(4, Math.floor(ideal * 0.4));

                start = Math.max(1, Math.floor(ideal - delta));
                end = Math.min(maxForThis, Math.ceil(ideal + delta));
            }

            for (let v = start; v <= end; v++) {
                currentDistribution[index] = v;
                generate(index + 1, currentSum + v, currentDistribution);
            }
        }

        function evaluate(dist) {
            let requiredSheets = 0;
            for (let i = 0; i < k; i++) {
                const sheets = Math.ceil(items[i].qty / dist[i]);
                if (sheets > requiredSheets) requiredSheets = sheets;
            }

            let totalProduced = 0;
            let totalRequired = 0;
            let netWaste = 0;

            for (let i = 0; i < k; i++) {
                const produced = requiredSheets * dist[i];
                const required = items[i].qty;
                totalProduced += produced;
                totalRequired += required;
                netWaste += (produced - required);
            }

            if (!bestSol || requiredSheets < bestSol.sheets || (requiredSheets === bestSol.sheets && netWaste < bestSol.waste)) {
                bestSol = {
                    items: items,
                    distribution: [...dist],
                    sheets: requiredSheets,
                    produced: totalProduced,
                    waste: netWaste,
                    wastePercent: (netWaste / totalRequired) * 100
                };
            }
        }

        generate(0, 0, new Array(k));
        return bestSol;
    }

    function displayResults(strategy) {
        resultsContainer.innerHTML = '';
        resultsSection.classList.remove('hidden');

        if (!strategy || strategy.runs.length === 0) {
            resultsContainer.innerHTML = '<div class="glass-panel" style="text-align:center">Uygun çözüm bulunamadı.</div>';
            return;
        }

        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'strategy-summary glass-panel';
        summaryDiv.innerHTML = `
            <div class="strategy-header">
                <div>
                    <h3><i class="fa-solid fa-layer-group"></i> Sonuçlar</h3>
                    <div style="font-size:0.9rem; color:#94a3b8; margin-top:0.25rem">
                        Toplam Tabaka: <strong style="color:var(--text-light)">${strategy.totalSheets.toLocaleString()}</strong> | 
                        Toplam Fire: <strong style="color:${strategy.totalWaste > 0 ? '#ef4444' : '#10b981'}">${strategy.totalWaste.toLocaleString()}</strong>
                    </div>
                </div>
                 <div class="strategy-badge ${strategy.type}">
                    ${strategy.type === 'multi' ? 'Optimize Edildi' : 'Tek Montaj'}
                </div>
            </div>
        `;
        resultsContainer.appendChild(summaryDiv);

        strategy.runs.forEach((run, index) => {
            const card = document.createElement('div');
            card.className = 'result-card fade-in';
            card.style.animationDelay = `${index * 0.1}s`;

            let distHtml = '';
            run.distribution.forEach((slots, i) => {
                const item = run.items[i];
                const produced = slots * run.sheets;
                distHtml += `
                    <div class="dist-pill" title="Üretim: ${produced.toLocaleString()}">
                        <span class="dist-name">${item.name}</span>
                        <span class="stat-value">x${slots}</span>
                        <span class="dist-qty">(${item.qty.toLocaleString()})</span>
                    </div>
                `;
            });

            card.innerHTML = `
                <div class="result-header">
                    <span class="rank-badge">Montaj #${index + 1}</span>
                    <span style="font-weight:700; color:white;">${run.sheets.toLocaleString()} Tabaka</span>
                </div>
                <div class="result-stats">
                    <div class="stat-item">Bu Montajda Üretim</div>
                    <div class="stat-value">${run.produced.toLocaleString()}</div>
                    
                    <div class="stat-item">Bu Montajda Fire</div>
                    <div class="stat-value" style="color:#ef4444">${run.waste.toLocaleString()}</div>
                </div>
                <div style="margin-top:1rem">
                    <div style="font-size:0.85rem; color:#94a3b8; margin-bottom:0.5rem">Kalıp Dizilimi (Bıçak: ${document.getElementById('totalSlots').value} Göz):</div>
                    <div class="distribution-list">
                        ${distHtml}
                    </div>
                </div>
            `;
            resultsContainer.appendChild(card);
        });

        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function exportToExcel() {
        if (!currentStrategy || !currentStrategy.runs.length || !calculatedItems.length) return;

        // Use calculatedItems which contains the IDs and is the exact list used for calculation
        // This preserves order and allows matching by unique ID instead of Name
        const sizeRows = calculatedItems;

        const data = [];
        const maxRow = 10 + sizeRows.length;

        for (let i = 0; i < maxRow; i++) {
            data[i] = [];
        }

        currentStrategy.runs.forEach((run, i) => {
            data[2][4 + i] = run.sheets;
        });

        sizeRows.forEach((item, rowIndex) => {
            const gridRow = 4 + rowIndex;

            data[gridRow][2] = item.name;
            data[gridRow][3] = item.qty;

            currentStrategy.runs.forEach((run, runIndex) => {
                // Match by ID to handle duplicate names correctly
                const productIndex = run.items.findIndex(ri => ri.id === item.id);
                let slots = '';
                if (productIndex !== -1) {
                    slots = run.distribution[productIndex];
                } else {
                    slots = 0;
                }
                data[gridRow][4 + runIndex] = slots;
            });
        });

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wscols = [];
        wscols[0] = { wch: 5 };
        wscols[1] = { wch: 5 };
        wscols[2] = { wch: 20 };
        wscols[3] = { wch: 10 };
        currentStrategy.runs.forEach(() => wscols.push({ wch: 10 }));
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Etiket Planı");

        XLSX.writeFile(wb, "etiket_optimizasyon.xlsx");
    }

    // --- PDF İşlemleri Logic ---
    const pdfOpsBtn = document.getElementById('pdfOpsBtn');
    const pdfOpsSection = document.getElementById('pdfOpsSection');
    const pdfDropZone = document.getElementById('pdfDropZone');
    const pdfFileInput = document.getElementById('pdfFileInput');
    const pdfFileInfo = document.getElementById('pdfFileInfo');
    const splitPdfBtn = document.getElementById('splitPdfBtn');
    let currentPdfFile = null;

    if (pdfOpsBtn) {
        pdfOpsBtn.addEventListener('click', () => {
            pdfOpsSection.classList.toggle('hidden');
        });
    }

    if (pdfDropZone) {
        pdfDropZone.addEventListener('click', () => pdfFileInput.click());

        pdfDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            pdfDropZone.classList.add('dragover');
        });

        pdfDropZone.addEventListener('dragleave', () => {
            pdfDropZone.classList.remove('dragover');
        });

        pdfDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            pdfDropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                handlePdfFile(e.dataTransfer.files[0]);
            }
        });

        document.addEventListener('paste', (e) => {
            // Sadece form elemanları dışındayken paste yapıldığında çalışsın
            const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            if (activeTag === 'input' || activeTag === 'textarea') return;

            if (e.clipboardData && e.clipboardData.files.length > 0) {
                const file = e.clipboardData.files[0];
                if (file.type === 'application/pdf') {
                    handlePdfFile(file);
                    pdfOpsSection.classList.remove('hidden');
                }
            }
        });

        pdfFileInput.addEventListener('change', function () {
            if (this.files.length > 0) {
                handlePdfFile(this.files[0]);
            }
        });
    }

    function handlePdfFile(file) {
        if (file.type !== 'application/pdf') {
            alert('Lütfen sadece PDF dosyası yükleyin.');
            return;
        }
        currentPdfFile = file;
        pdfFileInfo.textContent = `Seçilen Dosya: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        pdfFileInfo.style.display = 'block';
        splitPdfBtn.disabled = false;
    }

    if (splitPdfBtn) {
        splitPdfBtn.addEventListener('click', async () => {
            if (!currentPdfFile) return;

            try {
                splitPdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
                splitPdfBtn.disabled = true;

                const arrayBuffer = await currentPdfFile.arrayBuffer();
                const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
                const pageCount = pdfDoc.getPageCount();

                const originalName = currentPdfFile.name.replace(/\.[^/.]+$/, "");
                
                let dirHandle = null;
                try {
                    // Try to get permission to save to desktop
                    if (window.showDirectoryPicker) {
                        dirHandle = await window.showDirectoryPicker({ 
                            mode: 'readwrite' 
                        });
                    }
                } catch (err) {
                    console.log('Kullanıcı dizin seçmedi, klasik indirme kullanılacak.');
                }

                for (let i = 0; i < pageCount; i++) {
                    const newPdfDoc = await PDFLib.PDFDocument.create();
                    const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
                    newPdfDoc.addPage(copiedPage);

                    const pdfBytes = await newPdfDoc.save();
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    const fileName = `${originalName}_${i + 1}.pdf`;

                    if (dirHandle) {
                        try {
                            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                            const writable = await fileHandle.createWritable();
                            await writable.write(blob);
                            await writable.close();
                        } catch (e) {
                            console.error('Dosya yazma hatası:', e);
                            downloadBlob(blob, fileName);
                        }
                    } else {
                        downloadBlob(blob, fileName);
                    }
                    
                    // Small delay helps browser process multiple downloads smoothly
                    if (!dirHandle) await new Promise(res => setTimeout(res, 300));
                }

                alert(`PDF başarıyla ${pageCount} sayfaya bölündü! \n${dirHandle ? 'Seçtiğiniz klasöre kaydedildi.' : 'İndirilenler klasörüne indirildi.'}`);
            } catch (error) {
                console.error('PDF bölme hatası:', error);
                alert('PDF bölünürken bir hata oluştu veya kütüphane yüklenemedi. Lütfen internet bağlantınızı kontrol edin.');
            } finally {
                splitPdfBtn.innerHTML = '<i class="fa-solid fa-scissors"></i> PDF Böl';
                splitPdfBtn.disabled = false;
            }
        });
    }

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
});
