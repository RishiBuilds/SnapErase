document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const loader = document.getElementById('loader');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const errorToast = document.getElementById('errorToast');
    const errorMsg = document.getElementById('errorMsg');

    const uploadTitle = document.getElementById('uploadTitle');
    const uploadDesc = document.getElementById('uploadDesc');
    const resultState = document.getElementById('resultState');
    const comparisonContainer = document.getElementById('comparisonContainer');
    const imgBefore = document.getElementById('imgBefore');
    const imgAfter = document.getElementById('imgAfter');
    const sliderHandle = document.getElementById('sliderHandle');

    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');

    let processedBlob = null;
    let progressInterval = null;
    const MAX_SIZE = 16 * 1024 * 1024; // 16MB

    // Navbar Scroll Logic
    const navbar = document.querySelector('.navbar');
    const handleScroll = () => {
        if (window.scrollY > 20) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    // Helpers
    const getCsrfToken = () => document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    const resetUploadText = () => {
        uploadTitle.textContent = "Upload Image →";
        uploadDesc.textContent = "Processing starts instantly";
    };

    // Upload Logic
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
        uploadZone.addEventListener(event, e => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    uploadZone.addEventListener('dragenter', () => {
        uploadZone.classList.add('dragover');
        uploadTitle.textContent = "Drop to remove background";
        uploadDesc.textContent = "Release to start magic";
    });

    uploadZone.addEventListener('dragover', () => {
        if (!uploadZone.classList.contains('dragover')) {
            uploadZone.classList.add('dragover');
        }
    });

    uploadZone.addEventListener('dragleave', (e) => {
        if (!uploadZone.contains(e.relatedTarget)) {
            uploadZone.classList.remove('dragover');
            resetUploadText();
        }
    });

    uploadZone.addEventListener('drop', e => {
        uploadZone.classList.remove('dragover');
        resetUploadText();
        const file = e.dataTransfer.files[0];
        handleFile(file);
    });

    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', e => {
        if (e.target.files[0]) handleFile(e.target.files[0]);
        fileInput.value = '';
    });

    async function handleFile(file) {
        if (!file) return;

        // Validation
        if (!file.type.startsWith('image/')) {
            showError('Unsupported file type. Please upload a PNG, JPG, or WebP image.');
            return;
        }

        if (file.size > MAX_SIZE) {
            showError(`File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max size is 16MB.`);
            return;
        }

        hideError();
        uploadZone.style.pointerEvents = 'none';
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

                    const aspectRatio = imgAfter.naturalHeight / imgAfter.naturalWidth;
                    comparisonContainer.style.aspectRatio = 'auto';
                    comparisonContainer.style.height = `${comparisonContainer.offsetWidth * aspectRatio}px`;

                    window.addEventListener('resize', () => {
                        comparisonContainer.style.height = `${comparisonContainer.offsetWidth * aspectRatio}px`;
                    }, { once: true });

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
            uploadZone.style.pointerEvents = 'auto';
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

            const imgBefore = this.container.querySelector('img:not(.image-after)');

            requestAnimationFrame(() => {
                // Clip "Before" to the left
                if (imgBefore) {
                    imgBefore.style.clipPath = `inset(0 ${100 - this.position}% 0 0)`;
                }
                // Clip "After" to the right
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
        uploadZone.style.pointerEvents = 'auto';
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

    // Demo Slider
    const demoSlider = document.getElementById('demoSlider');
    const demoSliderHandle = document.getElementById('demoSliderHandle');
    const demoImgAfter = demoSlider ? demoSlider.querySelector('.image-after') : null;
    const demoImgBefore = demoSlider ? demoSlider.querySelector('img:not(.image-after)') : null;

    if (demoSlider && demoSliderHandle && demoImgAfter) {
        const setDemoHeight = () => {
            if (demoImgBefore && demoImgBefore.naturalWidth) {
                const aspectRatio = demoImgBefore.naturalHeight / demoImgBefore.naturalWidth;
                demoSlider.style.height = `${demoSlider.offsetWidth * aspectRatio}px`;
            } else {
                demoSlider.style.height = `${demoSlider.offsetWidth * 0.625}px`;
            }
        };

        if (demoImgBefore && demoImgBefore.complete) {
            setDemoHeight();
        } else if (demoImgBefore) {
            demoImgBefore.addEventListener('load', setDemoHeight);
        }

        window.addEventListener('resize', setDemoHeight);
        new ImageCompareSlider(demoSlider, demoSliderHandle, demoImgAfter);
    }
});
