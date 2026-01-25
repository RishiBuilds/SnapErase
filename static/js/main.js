document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const loader = document.getElementById('loader');
    const errorToast = document.getElementById('errorToast');
    const comparisonContainer = document.getElementById('comparisonContainer');
    const imgBefore = document.getElementById('imgBefore');
    const imgAfter = document.getElementById('imgAfter');
    const sliderHandle = document.getElementById('sliderHandle');
    const actionBar = document.getElementById('actionBar');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');

    let processedBlob = null;

    // CSRF Token helper (only if using flask-wtf)
    const getCsrfToken = () => document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    // Drag and Drop Logic
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
        uploadZone.addEventListener(event, e => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    uploadZone.addEventListener('dragenter', () => uploadZone.classList.add('dragover'));
    uploadZone.addEventListener('dragover', () => uploadZone.classList.add('dragover'));
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', e => {
        uploadZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        handleFile(file);
    });

    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
        if (e.target.files[0]) handleFile(e.target.files[0]);
    });

    async function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            showError('Please upload a valid image file (PNG, JPG, WebP).');
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        // Reset UI
        hideError();
        uploadZone.style.display = 'none';
        loader.style.display = 'block';
        comparisonContainer.style.display = 'none';
        actionBar.style.display = 'none';

        // Preview original instantly
        imgBefore.src = URL.createObjectURL(file);

        try {
            const response = await fetch('/remove-bg', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCsrfToken()
                },
                body: formData
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Processing failed');
            }

            processedBlob = await response.blob();
            const processedUrl = URL.createObjectURL(processedBlob);

            // Setup onload before setting src
            imgAfter.onload = () => {
                loader.style.display = 'none';
                comparisonContainer.style.display = 'block';
                actionBar.style.display = 'flex';
                initSlider();
            };

            imgAfter.src = processedUrl;

        } catch (err) {
            loader.style.display = 'none';
            uploadZone.style.display = 'block';
            showError(err.message);
        }
    }

    // Before/After Slider Logic
    function initSlider() {
        let isResizing = false;

        const setSliderPos = (x) => {
            const rect = comparisonContainer.getBoundingClientRect();
            let pos = ((x - rect.left) / rect.width) * 100;
            pos = Math.max(0, Math.min(pos, 100)); // Constraint

            imgAfter.style.width = `${100 - pos}%`;
            imgAfter.style.left = `${pos}%`;
            imgAfter.style.objectPosition = `${pos}% 0%`; // Important for fixed background effect if desired, but here we use simple clip-path alternative or width

            // Clip-path implementation (More performant)
            imgAfter.style.width = `100%`;
            imgAfter.style.left = `0`;
            imgAfter.style.clipPath = `inset(0 0 0 ${pos}%)`;

            sliderHandle.style.left = `${pos}%`;
        };

        // Initial Position
        setSliderPos(comparisonContainer.getBoundingClientRect().left + comparisonContainer.offsetWidth / 2);

        comparisonContainer.addEventListener('mousedown', () => isResizing = true);
        window.addEventListener('mouseup', () => isResizing = false);
        window.addEventListener('mousemove', e => {
            if (!isResizing) return;
            setSliderPos(e.pageX);
        });

        // Touch support
        comparisonContainer.addEventListener('touchstart', () => isResizing = true);
        window.addEventListener('touchend', () => isResizing = false);
        window.addEventListener('touchmove', e => {
            if (!isResizing) return;
            setSliderPos(e.touches[0].pageX);
        });
    }

    // Actions
    downloadBtn.addEventListener('click', () => {
        if (!processedBlob) return;
        const url = URL.createObjectURL(processedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'snaperase_result.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    resetBtn.addEventListener('click', () => {
        uploadZone.style.display = 'block';
        comparisonContainer.style.display = 'none';
        actionBar.style.display = 'none';
        fileInput.value = '';
    });

    function showError(msg) {
        errorToast.textContent = msg;
        errorToast.style.display = 'block';
    }

    function hideError() {
        errorToast.style.display = 'none';
    }
});
