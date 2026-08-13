// Global configuration and library setup
const { jsPDF } = window.jspdf;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// State Variables
let selectedImages = [];
let loadedPDFToJPG = null;

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-btn');
const toolViews = document.querySelectorAll('.tool-view');

// Image-to-PDF DOM Elements
const dropzoneImages = document.getElementById('dropzone-images');
const inputImages = document.getElementById('input-images');
const imagesPreviewList = document.getElementById('images-preview-list');
const imageThumbnails = document.getElementById('image-thumbnails');
const imageCountSpan = document.getElementById('image-count');
const pdfFilenameInput = document.getElementById('pdf-filename');
const pdfQualitySlider = document.getElementById('pdf-quality');
const qualityValueSpan = document.getElementById('quality-val');
const btnGeneratePDF = document.getElementById('btn-generate-pdf');

// PDF-to-JPG DOM Elements
const dropzonePDFJPG = document.getElementById('dropzone-pdf-jpg');
const inputPDFJPG = document.getElementById('input-pdf-jpg');
const pdfJPGInfo = document.getElementById('pdf-jpg-info');
const pdfJPGName = document.getElementById('pdf-jpg-name');
const pdfJPGPages = document.getElementById('pdf-jpg-pages');
const btnConvertJPG = document.getElementById('btn-convert-jpg');

// Shared Results DOM Elements
const resultsSection = document.getElementById('results-section');
const resultsGallery = document.getElementById('results-gallery');
const btnClearResults = document.getElementById('btn-clear-results');

/* ==========================================================================
   Tab Navigation Logic
   ========================================================================== */
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        toolViews.forEach(view => view.classList.remove('active'));

        button.classList.add('active');
        const targetTab = button.getAttribute('data-tab');
        document.getElementById(targetTab).classList.add('active');
    });
});

/* ==========================================================================
   Helper Functions
   ========================================================================== */
// Utility to handle visual drag highlights
function initDragFeedback(dropzoneElement) {
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzoneElement.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneElement.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzoneElement.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneElement.classList.remove('drag-over');
        }, false);
    });
}

// Convert a single File object to a Base64 URL
function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

// Build a canvas element and draw image based on compression rules
function compressImage(imgSrc, format = 'JPEG', quality = 0.85) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const mimeType = format === 'PNG' ? 'image/png' : 'image/jpeg';
            const compressedDataUrl = canvas.toDataURL(mimeType, quality);
            resolve({
                dataUrl: compressedDataUrl,
                width: img.naturalWidth,
                height: img.naturalHeight
            });
        };
        img.src = imgSrc;
    });
}

// Add a parsed image file card to the global results gallery
function createResultCard(dataUrl, filename) {
    resultsSection.style.display = 'block';

    const card = document.createElement('div');
    card.className = 'result-card';

    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'result-thumb-wrapper';

    const img = document.createElement('img');
    img.src = dataUrl;
    img.className = 'result-thumb';
    img.alt = filename;

    const meta = document.createElement('div');
    meta.className = 'result-meta';
    meta.textContent = filename;

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn-download-single';
    downloadBtn.innerHTML = `<i class="fa-solid fa-arrow-down-to-line"></i> Download`;
    downloadBtn.onclick = () => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    thumbWrapper.appendChild(img);
    card.appendChild(thumbWrapper);
    card.appendChild(meta);
    card.appendChild(downloadBtn);
    resultsGallery.appendChild(card);
}

/* ==========================================================================
   Tool 1: Image to PDF Converter
   ========================================================================== */
initDragFeedback(dropzoneImages);

pdfQualitySlider.addEventListener('input', () => {
    qualityValueSpan.textContent = `${pdfQualitySlider.value}%`;
});

// Watch files dropping in
dropzoneImages.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    processImageFiles(files);
});

inputImages.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    processImageFiles(files);
});

async function processImageFiles(files) {
    for (const file of files) {
        try {
            const dataUrl = await fileToDataURL(file);
            selectedImages.push({
                id: Date.now() + Math.random(),
                name: file.name,
                dataUrl: dataUrl
            });
        } catch (err) {
            console.error('Error parsing image source file: ', err);
        }
    }
    updateImagePreview();
}

function updateImagePreview() {
    imageThumbnails.innerHTML = '';
    
    if (selectedImages.length > 0) {
        imagesPreviewList.style.display = 'block';
        btnGeneratePDF.removeAttribute('disabled');
        imageCountSpan.textContent = selectedImages.length;

        selectedImages.forEach((img, idx) => {
            const item = document.createElement('div');
            item.className = 'preview-item';

            const previewImg = document.createElement('img');
            previewImg.src = img.dataUrl;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'preview-remove-btn';
            removeBtn.innerHTML = '✕';
            removeBtn.onclick = () => {
                selectedImages.splice(idx, 1);
                updateImagePreview();
            };

            item.appendChild(previewImg);
            item.appendChild(removeBtn);
            imageThumbnails.appendChild(item);
        });
    } else {
        imagesPreviewList.style.display = 'none';
        btnGeneratePDF.setAttribute('disabled', 'true');
        imageCountSpan.textContent = '0';
    }
}

btnGeneratePDF.addEventListener('click', async () => {
    if (selectedImages.length === 0) return;

    btnGeneratePDF.setAttribute('disabled', 'true');
    const originalText = btnGeneratePDF.innerHTML;
    btnGeneratePDF.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Bundling PDF...`;

    try {
        const quality = parseFloat(pdfQualitySlider.value) / 100;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = 210; // A4 standard width in mm
        const pdfHeight = 297; // A4 standard height in mm

        for (let i = 0; i < selectedImages.length; i++) {
            if (i > 0) {
                pdf.addPage();
            }

            const imgObj = selectedImages[i];
            const result = await compressImage(imgObj.dataUrl, 'JPEG', quality);

            // Calculate responsive aspect ratio layout in mm coordinates
            const ratio = result.width / result.height;
            let finalWidth = pdfWidth;
            let finalHeight = pdfWidth / ratio;

            if (finalHeight > pdfHeight) {
                finalHeight = pdfHeight;
                finalWidth = pdfHeight * ratio;
            }

            const posX = (pdfWidth - finalWidth) / 2;
            const posY = (pdfHeight - finalHeight) / 2;

            pdf.addImage(result.dataUrl, 'JPEG', posX, posY, finalWidth, finalHeight);
        }

        const rawFilename = pdfFilenameInput.value.trim() || 'Slide2PDF_Document';
        const sanitizedFilename = rawFilename.endsWith('.pdf') ? rawFilename : `${rawFilename}.pdf`;
        await applyWatermark(pdf);
        pdf.save(sanitizedFilename);
    } catch (e) {
        console.error('Error building your PDF: ', e);
    } finally {
        btnGeneratePDF.removeAttribute('disabled');
        btnGeneratePDF.innerHTML = originalText;
    }
});


/* ==========================================================================
   Tool 2: PDF to JPG
   ========================================================================== */
initDragFeedback(dropzonePDFJPG);

dropzonePDFJPG.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');
    if (files.length > 0) handlePDFSelection(files[0], 'JPG');
});

inputPDFJPG.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handlePDFSelection(e.target.files[0], 'JPG');
});


/* ==========================================================================
   Core PDF Parser & Extractor
   ========================================================================== */
async function handlePDFSelection(file, format) {
    try {
        const fileData = await file.arrayBuffer();
        const typedArray = new Uint8Array(fileData);
        const loadingTask = pdfjsLib.getDocument({ data: typedArray });
        const pdf = await loadingTask.promise;

        if (format === 'JPG') {
            loadedPDFToJPG = { pdf, name: file.name };
            pdfJPGName.textContent = file.name;
            pdfJPGPages.textContent = `${pdf.numPages} ${pdf.numPages === 1 ? 'page' : 'pages'}`;
            pdfJPGInfo.style.display = 'flex';
            btnConvertJPG.removeAttribute('disabled');
        } else {
            loadedPDFToPNG = { pdf, name: file.name };
            pdfPNGName.textContent = file.name;
            pdfPNGPages.textContent = `${pdf.numPages} ${pdf.numPages === 1 ? 'page' : 'pages'}`;
            pdfPNGInfo.style.display = 'flex';
            btnConvertPNG.removeAttribute('disabled');
        }
    } catch (error) {
        alert('Invalid PDF format or protected document.');
        console.error('PDF parsing error: ', error);
    }
}

// Convert PDF to JPG Execution
btnConvertJPG.addEventListener('click', async () => {
    if (!loadedPDFToJPG) return;
    await convertPDFToImages(loadedPDFToJPG.pdf, loadedPDFToJPG.name, 'JPG', btnConvertJPG);
});

async function convertPDFToImages(pdf, baseFilename, format, buttonEl) {
    buttonEl.setAttribute('disabled', 'true');
    const originalText = buttonEl.innerHTML;
    
    try {
        const baseCleanName = baseFilename.replace(/\.[^/.]+$/, ""); // Strip out file extension
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            buttonEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Extracting page ${pageNum} / ${pdf.numPages}...`;
            
            const page = await pdf.getPage(pageNum);
            // Render at high detail (2.0 scale viewport)
            const viewport = page.getViewport({ scale: 2.0 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
      // --- Image Watermark Code Start ---
      let toggleId = format === 'PNG' ? 'removeWatermarkTogglePng' : 'removeWatermarkToggleJpg';
      let isWatermarkRemoved = document.getElementById(toggleId) && document.getElementById(toggleId).checked;
      
      if (!isWatermarkRemoved) {
        try {
          const wmImg = await loadImage('1000112685.png');
          const wmWidth = canvas.width * 0.25; // ওয়াটারমার্কের সাইজ ২৫%
          const wmHeight = (wmImg.height / wmImg.width) * wmWidth;
          const wmX = canvas.width - wmWidth - 20; // ডানদিক থেকে ফাঁকা
          const wmY = canvas.height - wmHeight - 20; // নিচ থেকে ফাঁকা
          context.drawImage(wmImg, wmX, wmY, wmWidth, wmHeight);
        } catch(e) {
          console.error('Watermark error:', e);
        }
      }
      // --- Image Watermark Code End ---
                   
            const mimeType = format === 'PNG' ? 'image/png' : 'image/jpeg';
            const extension = format === 'PNG' ? 'png' : 'jpg';
            const dataUrl = canvas.toDataURL(mimeType, 0.9);
            const imageFilename = `${baseCleanName}_page_${pageNum}.${extension}`;

            createResultCard(dataUrl, imageFilename);
        }
        
        // Scroll automatically to visible results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        alert('Extraction interrupted. Ensure your PDF does not contain encrypted layouts.');
        console.error('Render pipeline crash: ', err);
    } finally {
        buttonEl.removeAttribute('disabled');
        buttonEl.innerHTML = originalText;
    }
}

/* ==========================================================================
   Clear Gallery Control Logic
   ========================================================================== */
btnClearResults.addEventListener('click', () => {
    resultsGallery.innerHTML = '';
    resultsSection.style.display = 'none';
});
document.addEventListener('DOMContentLoaded', () => {
  const triggerBtn = document.getElementById('feedback-trigger-btn');
  const overlay = document.getElementById('feedback-modal-overlay');
  const closeBtn = document.getElementById('feedback-close-btn');

  // Function to open the modal
  const openModal = () => {
    overlay.style.display = 'flex';
    // Small delay ensures transition triggers smoothly after display: flex is set
    setTimeout(() => {
      overlay.classList.add('active');
    }, 10);
  };

  // Function to close the modal
  const closeModal = () => {
    overlay.classList.remove('active');
    // Wait for the transition duration before setting display to none
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
  };

  // Event Listeners
  triggerBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);

  // Close modal when clicking outside the glass content card
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeModal();
    }
  });

  // Close modal with Escape key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('active')) {
      closeModal();
    }
  });
});

/**
 * Helper function to load an image file asynchronously
 * @param {string} url - Image path/url
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load watermark image: ${err}`));
    img.src = url;
  });
}

/**
 * Applies an image watermark to all pages of a jsPDF document if the toggle is UNCHECKED.
 * 
 * @param {jsPDF} doc - The jsPDF document instance
 */
async function applyWatermark(doc) {
  const removeWatermarkToggle = document.getElementById('removeWatermarkToggle');

  // Logic: If user checked "Remove Watermark", skip completely
  if (removeWatermarkToggle && removeWatermarkToggle.checked) {
    return;
  }

  try {
    // 1. Preload the watermark image
    const watermarkImg = await loadImage('1000112685.png');

    const totalPages = doc.getNumberOfPages ? doc.getNumberOfPages() : doc.internal.getNumberOfPages();

    // Set watermark dimensions in PDF units (e.g. mm or pt depending on your jsPDF initialization)
    const targetWidth = 40; // Desired watermark width in PDF units
    const targetHeight = (watermarkImg.height / watermarkImg.width) * targetWidth; // Preserve aspect ratio

    // 2. Loop through every page and place the watermark
    for (let page = 1; page <= totalPages; page++) {
      doc.setPage(page);

      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = doc.internal.pageSize.getHeight();

      // Position: Bottom-Center with a 10-unit padding from the bottom margin
      const xPos = pdfWidth - targetWidth - 10;
      const yPos = pdfHeight - targetHeight - 10;

      // Add watermark image (formats automatically detected or specified as PNG)
      doc.addImage(watermarkImg, 'PNG', xPos, yPos, targetWidth, targetHeight);
    }
  } catch (error) {
    console.error('Error applying watermark:', error);
  }
       }
