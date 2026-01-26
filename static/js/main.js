document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const loader = document.getElementById('loader');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const errorToast = document.getElementById('errorToast');
    const errorMsg = document.getElementById('errorMsg');

    const resultState = document.getElementById('resultState');
    const comparisonContainer = document.getElementById('comparisonContainer');
    const imgBefore = document.getElementById('imgBefore');
    const imgAfter = document.getElementById('imgAfter');
    const sliderHandle = document.getElementById('sliderHandle');

    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');

    let processedBlob = null;
    let progressInterval = null;

    // --- Helpers ---
    const getCsrfToken = () => document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    // --- Upload Logic ---
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

        hideError();
        uploadZone.style.display = 'none';
        loader.style.display = 'block';
        resultState.style.display = 'none';

        // Start Progress Simulation
        startProgressSimulation();

        const formData = new FormData();
        formData.append('image', file);

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

            imgAfter.onload = () => {
                completeProgress().then(() => {
                    loader.style.display = 'none';
                    resultState.style.display = 'block';
                    resultState.classList.add('fade-in');
                    initSlider();

                    if (window.innerWidth < 768) {
                        resultState.scrollIntoView({ behavior: 'smooth' });
                    }
                });
            };

            imgAfter.src = processedUrl;

        } catch (err) {
            clearInterval(progressInterval);
            loader.style.display = 'none';
            uploadZone.style.display = 'block';
            showError(err.message);
        }
    }

    // --- Progress Simulation ---
    function startProgressSimulation() {
        progressBar.style.width = '0%';
        let progress = 0;
        const messages = ["Uploading...", "Analyzing dimensions...", "Removing background...", "Refining edges...", "Finishing up..."];

        progressInterval = setInterval(() => {
            if (progress < 90) {
                progress += Math.random() * 5;
                if (progress > 90) progress = 90;

                progressBar.style.width = `${progress}%`;

                const msgIndex = Math.floor((progress / 90) * (messages.length - 1));
                progressText.textContent = messages[msgIndex];
            }
        }, 200);
    }

    function completeProgress() {
        return new Promise(resolve => {
            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            progressText.textContent = "Done!";
            setTimeout(resolve, 500);
        });
    }

    // --- Slider Logic ---
    class ImageCompareSlider {
        constructor(container, handle, imgAfter) {
            this.container = container;
            this.handle = handle;
            this.imgAfter = imgAfter;
            this.isResizing = false;
            this.position = 50;

            // Bind methods
            this.startResize = this.startResize.bind(this);
            this.stopResize = this.stopResize.bind(this);
            this.handleResize = this.handleResize.bind(this);
            this.handleKeydown = this.handleKeydown.bind(this);

            this.init();
        }

        init() {
            // Mouse & Touch Events
            this.handle.addEventListener('mousedown', this.startResize);
            this.container.addEventListener('mousedown', this.startResize);

            window.addEventListener('mouseup', this.stopResize);
            window.addEventListener('mousemove', this.handleResize);

            // Touch support
            this.handle.addEventListener('touchstart', (e) => {
                this.startResize(e);
            }, { passive: false });
            this.container.addEventListener('touchstart', (e) => {
                this.startResize(e);
            }, { passive: false });

            window.addEventListener('touchend', this.stopResize);
            window.addEventListener('touchmove', this.handleResize, { passive: false });

            // Keyboard support
            this.handle.setAttribute('tabindex', '0');
            this.handle.setAttribute('role', 'slider');
            this.handle.setAttribute('aria-label', 'Comparison slider');
            this.handle.setAttribute('aria-valuemin', '0');
            this.handle.setAttribute('aria-valuemax', '100');
            this.handle.addEventListener('keydown', this.handleKeydown);

            // Initial Draw
            this.setPosition(50);
        }

        startResize(e) {
            if (e.type === 'touchstart') {
            }
            this.isResizing = true;
            this.container.classList.add('resizing');

            this.handleResize(e);
        }

        stopResize() {
            this.isResizing = false;
            this.container.classList.remove('resizing');
        }

        handleResize(e) {
            if (!this.isResizing) return;

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;

            const rect = this.container.getBoundingClientRect();
            let pos = ((clientX - rect.left) / rect.width) * 100;

            this.setPosition(pos);
        }

        handleKeydown(e) {
            let step = 5;
            if (e.shiftKey) step = 10;

            if (e.key === 'ArrowLeft') {
                this.setPosition(this.position - step);
            } else if (e.key === 'ArrowRight') {
                this.setPosition(this.position + step);
            }
        }

        setPosition(pos) {
            this.position = Math.max(0, Math.min(pos, 100));

            requestAnimationFrame(() => {
                this.imgAfter.style.width = '100%';
                this.imgAfter.style.left = '0';
                this.imgAfter.style.clipPath = `inset(0 0 0 ${this.position}%)`;

                this.handle.style.left = `${this.position}%`;

                this.handle.setAttribute('aria-valuenow', Math.round(this.position));
            });
        }

        reset() {
            this.setPosition(50);
        }
    }

    let sliderInstance = null;

    function initSlider() {
        if (!sliderInstance) {
            sliderInstance = new ImageCompareSlider(comparisonContainer, sliderHandle, imgAfter);
        } else {
            sliderInstance.reset();
        }
    }

    // --- Actions ---
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
        resultState.style.display = 'none';
        fileInput.value = '';
        imgBefore.src = '';
        imgAfter.src = '';
        hideError();
    });

    function showError(msg) {
        errorMsg.textContent = msg;
        errorToast.style.display = 'flex';
    }

    function hideError() {
        errorToast.style.display = 'none';
    }

    // --- FAQ Accordion ---
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            faqItems.forEach(other => {
                if (other !== item) other.classList.remove('active');
            });
            item.classList.toggle('active');
        });
    });
});
