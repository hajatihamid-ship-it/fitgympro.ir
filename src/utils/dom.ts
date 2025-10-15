// This file contains helper functions for DOM manipulation and UI interactions.

/**
 * Converts a hex color string to an rgba string.
 * @param hex The hex color string (e.g., '#RRGGBB' or '#RGB').
 * @param alpha The alpha transparency value (0 to 1).
 * @returns The rgba color string.
 */
export const hexToRgba = (hex: string, alpha: number): string => {
    let r = 0, g = 0, b = 0;
    // 3 digits
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    // 6 digits
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const sanitizeHTML = (str: string): string => {
    if (typeof str !== 'string') return '';
    const temp = document.createElement("div");
    temp.textContent = str;
    return temp.innerHTML;
};

export const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    let icon, colors;

    switch (type) {
        case 'success':
            icon = "check-circle";
            colors = "bg-green-500 border-green-600 text-white";
            break;
        case 'error':
            icon = "alert-triangle";
            colors = "bg-red-500 border-red-600 text-white";
            break;
        case 'warning':
            icon = "alert-triangle";
            colors = "bg-yellow-400 border-yellow-500 text-black";
            break;
    }
    
    toast.className = `flex items-center gap-3 ${colors} py-3 px-5 rounded-lg shadow-xl border-b-4 transform opacity-0 translate-x-full`;
    toast.style.transition = "transform 0.5s ease, opacity 0.5s ease";
    toast.innerHTML = `
        <i data-lucide="${icon}" class="w-6 h-6"></i>
        <span>${sanitizeHTML(message)}</span>
    `;

    container.appendChild(toast);
    window.lucide?.createIcons();

    requestAnimationFrame(() => {
        toast.classList.remove("opacity-0", "translate-x-full");
    });

    setTimeout(() => {
        toast.classList.add("opacity-0");
        toast.style.transform = "translateX(120%)";
        toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    }, 4000); // Increased duration for warnings
};

export const updateSliderTrack = (slider: HTMLInputElement) => {
    if (!slider) return;
    const min = +slider.min || 0;
    const max = +slider.max || 100;
    const val = (+slider.value || 0);
    const percentage = (val - min) / (max - min) * 100;
    
    // Check for custom color from parent
    const parentContainer = slider.closest('[class*="slider-container-"]');
    let accentColor = 'var(--accent)';
    if (parentContainer) {
        if (parentContainer.classList.contains('slider-container-blue')) accentColor = 'var(--admin-accent-blue)';
        else if (parentContainer.classList.contains('slider-container-green')) accentColor = 'var(--admin-accent-green)';
        else if (parentContainer.classList.contains('slider-container-orange')) accentColor = 'var(--admin-accent-orange)';
    }

    const trackColor = getComputedStyle(document.documentElement).getPropertyValue("--range-track-bg").trim();
    slider.style.background = `linear-gradient(to right, ${accentColor} ${percentage}%, ${trackColor} ${percentage}%)`;
};

export const openModal = (modalElement: HTMLElement | null) => {
    if (!modalElement) return;
    modalElement.classList.remove("hidden");
    setTimeout(() => {
        modalElement.classList.add("active", "opacity-100", "pointer-events-auto");
        modalElement.querySelector('.card, form, .modal-content')?.classList.remove('scale-95');
    }, 10);
};

export const closeModal = (modalElement: HTMLElement | null) => {
    if (!modalElement) return;
    modalElement.classList.remove("active", "opacity-100", "pointer-events-auto");
    modalElement.querySelector('.card, form, .modal-content')?.classList.add('scale-95');
    setTimeout(() => {
        modalElement.classList.add("hidden");
    }, 300);
};

export const exportElement = async (elementToExportSelector: string, format: 'pdf' | 'png', filename: string, button: HTMLButtonElement) => {
    const { jsPDF } = window.jspdf;
    const html2canvas = window.html2canvas;

    const elementToExport = document.querySelector(elementToExportSelector) as HTMLElement;
    if (!elementToExport || !jsPDF || !html2canvas) {
        showToast('خطا در آماده‌سازی برای ذخیره.', 'error');
        return;
    }

    button.classList.add('is-loading');
    button.disabled = true;

    try {
        const exportContainer = document.createElement('div');
        exportContainer.className = 'program-page';
        exportContainer.innerHTML = elementToExport.innerHTML;

        // Apply theme variables to ensure correct colors in export
        const computedStyles = getComputedStyle(document.documentElement);
        let cssVariables = '';
        for (let i = 0; i < computedStyles.length; i++) {
            const prop = computedStyles[i];
            if (prop.startsWith('--')) {
                cssVariables += `${prop}: ${computedStyles.getPropertyValue(prop)}; `;
            }
        }
        exportContainer.style.cssText += cssVariables;
        
        // Position off-screen and set width for correct rendering
        exportContainer.style.position = 'absolute';
        exportContainer.style.left = '-9999px';
        exportContainer.style.top = '0px';
        exportContainer.style.width = `${elementToExport.offsetWidth}px`;

        document.body.appendChild(exportContainer);
        
        const bgColor = computedStyles.getPropertyValue('--bg-secondary').trim();

        const canvas = await html2canvas(exportContainer, {
            scale: 2,
            useCORS: true,
            backgroundColor: bgColor,
        });

        document.body.removeChild(exportContainer);

        if (format === 'png') {
            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = imgData;
            link.download = filename;
            link.click();
        } else if (format === 'pdf') {
            const imgData = canvas.toDataURL('image/png');
            const { width, height } = canvas;
            const pdf = new jsPDF({
                orientation: width > height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [width, height]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, width, height);
            pdf.save(filename);
        }

        showToast(`فایل با موفقیت ذخیره شد.`, 'success');
    } catch (error) {
        console.error('Export Error:', error);
        showToast('خطا در ذخیره فایل.', 'error');
    } finally {
        button.classList.remove('is-loading');
        button.disabled = false;
    }
};

export const applySiteSettings = (settings: { accentColor: string }) => {
    const accent = settings.accentColor || '#a3e635';
    
    let settingsStyle = document.getElementById('site-settings-style');
    if (!settingsStyle) {
        settingsStyle = document.createElement('style');
        settingsStyle.id = 'site-settings-style';
        document.head.appendChild(settingsStyle);
    }
    
    settingsStyle.innerHTML = `
        :root, html[data-theme='light'], html[data-theme='dark'], html[data-theme='lemon'] {
            --accent: ${accent};
            --accent-hover: color-mix(in srgb, ${accent} 85%, black);
            --accent-transparent-8: color-mix(in srgb, ${accent} 8%, transparent);
            --accent-transparent-10: color-mix(in srgb, ${accent} 10%, transparent);
            --accent-transparent-15: color-mix(in srgb, ${accent} 15%, transparent);
            --accent-transparent-20: color-mix(in srgb, ${accent} 20%, transparent);
            --accent-transparent-30: color-mix(in srgb, ${accent} 30%, transparent);
            --accent-transparent-40: color-mix(in srgb, ${accent} 40%, transparent);
        }
    `;
};