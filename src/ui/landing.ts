import { openModal, closeModal } from '../utils/dom';
import { getSiteSettings, getUsers, getUserData, getStorePlans, getMagazineArticles } from '../services/storage';
import { performMetricCalculations, calculateMacros } from '../utils/calculations';
import { formatPrice, timeAgo } from '../utils/helpers';
import { switchAuthForm } from './authModal';
import { getCurrentUser } from '../state';
import type { SiteSettings, StorePlan } from '../types';

// Module-level variables to hold references to our event handlers.
// This allows us to remove the old listener before adding a new one,
// preventing duplicate listeners from being attached to persistent elements like 'body' or 'window'.
let landingPageClickHandler: ((e: MouseEvent) => void) | null = null;
let headerScrollHandler: (() => void) | null = null;
let userMenuTimeoutId: number | null = null;

const createGauge = (id: string, label: string) => `
    <div class="gauge-container">
        <h4 class="gauge-label">${label}</h4>
        <div class="gauge-svg-wrapper">
            <svg class="gauge-svg" viewBox="0 0 160 160">
                <circle class="gauge-track-circle" r="70" cx="80" cy="80"></circle>
                <circle id="${id}-arc" class="gauge-value-circle" r="70" cx="80" cy="80" style="stroke-dasharray: 440; stroke-dashoffset: 440;"></circle>
            </svg>
            <div class="gauge-text-content">
                <span id="${id}-value" class="gauge-value-text">--</span>
                <span id="${id}-unit" class="gauge-unit-text"></span>
            </div>
        </div>
        <div id="${id}-sub-info" class="gauge-sub-info"></div>
    </div>
`;

const renderCalculator = () => `
    <section id="fitness-calculator" class="py-16">
        <div class="container mx-auto px-4">
            <div class="calculator-wrapper">
                <div class="text-center mb-10">
                    <h2 class="text-3xl lg:text-4xl font-extrabold text-white">محاسبه‌گر پیشرفته تناسب اندام</h2>
                    <p class="mt-3 text-slate-400 max-w-2xl mx-auto">
                        اطلاعات خود را وارد کنید تا یک تحلیل کامل از وضعیت بدن و نیازهای روزانه خود دریافت کنید.
                    </p>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-10">
                    <!-- RIGHT COLUMN: All Inputs -->
                    <div class="space-y-8">
                        <div class="calculator-input-section">
                            <h3 class="!mb-4"><span>۱</span>اطلاعات پایه</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 items-end">
                                <div>
                                    <p class="font-semibold text-sm text-slate-300 mb-2">جنسیت</p>
                                    <div class="calculator-radio-group grid grid-cols-2 gap-4">
                                        <label>
                                            <input type="radio" name="gender_calc" value="مرد" class="option-card-input" checked>
                                            <div class="gender-selector-card">
                                                <i data-lucide="male"></i>
                                                <p>مرد</p>
                                            </div>
                                        </label>
                                        <label>
                                            <input type="radio" name="gender_calc" value="زن" class="option-card-input">
                                            <div class="gender-selector-card">
                                                <i data-lucide="female"></i>
                                                <p>زن</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                                <div class="slider-group slider-container-blue">
                                    <div class="calculator-slider-label">
                                        <span>سن</span>
                                        <input type="number" class="calculator-styled-input age-input" min="15" max="80" value="25">
                                    </div>
                                    <input type="range" class="calculator-slider age-slider w-full" min="15" max="80" value="25">
                                </div>

                                <div class="slider-group slider-container-green">
                                     <div class="calculator-slider-label">
                                        <span>قد (cm)</span>
                                        <input type="number" class="calculator-styled-input height-input" min="140" max="220" value="175">
                                    </div>
                                    <input type="range" class="calculator-slider height-slider w-full" min="140" max="220" value="175">
                                </div>

                                <div class="slider-group slider-container-orange">
                                     <div class="calculator-slider-label">
                                        <span>وزن (kg)</span>
                                        <input type="number" class="calculator-styled-input weight-input" min="40" max="150" step="0.5" value="75.0">
                                    </div>
                                    <input type="range" class="calculator-slider weight-slider w-full" min="40" max="150" step="0.5" value="75">
                                </div>
                            </div>
                        </div>

                        <div class="calculator-input-section">
                            <h3 class="!mb-4"><span>۲</span>سبک زندگی و اهداف</h3>
                            <div class="space-y-4">
                                <div class="calculator-radio-group">
                                    <p class="font-semibold text-sm mb-2 text-slate-300">هدف تمرینی</p>
                                    <div class="grid grid-cols-3 gap-2">
                                        <label class="option-card-label"><input type="radio" name="goal_calc" value="کاهش وزن" class="option-card-input"><span class="option-card-content !py-2">کاهش وزن</span></label>
                                        <label class="option-card-label"><input type="radio" name="goal_calc" value="حفظ وزن" class="option-card-input" checked><span class="option-card-content !py-2">حفظ وزن</span></label>
                                        <label class="option-card-label"><input type="radio" name="goal_calc" value="افزایش حجم" class="option-card-input"><span class="option-card-content !py-2">افزایش حجم</span></label>
                                    </div>
                                </div>
                                <div class="calculator-radio-group">
                                    <p class="font-semibold text-sm mb-2 text-slate-300">سطح فعالیت روزانه</p>
                                    <div class="grid grid-cols-3 gap-2">
                                        <label class="option-card-label"><input type="radio" name="activity_level_calc" value="1.2" class="option-card-input"><span class="option-card-content !py-2 !text-xs">نشسته</span></label>
                                        <label class="option-card-label"><input type="radio" name="activity_level_calc" value="1.375" class="option-card-input"><span class="option-card-content !py-2 !text-xs">کم</span></label>
                                        <label class="option-card-label"><input type="radio" name="activity_level_calc" value="1.55" class="option-card-input" checked><span class="option-card-content !py-2 !text-xs">متوسط</span></label>
                                        <label class="option-card-label"><input type="radio" name="activity_level_calc" value="1.725" class="option-card-input"><span class="option-card-content !py-2 !text-xs">زیاد</span></label>
                                        <label class="option-card-label"><input type="radio" name="activity_level_calc" value="1.9" class="option-card-input"><span class="option-card-content !py-2 !text-xs">خیلی زیاد</span></label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- LEFT COLUMN: All Results -->
                    <div id="calculator-results" class="space-y-4">
                        <h3 class="text-white font-bold text-lg text-center mb-4">نتایج شما</h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          ${createGauge('tdee-gauge', 'کالری روزانه')}
                          ${createGauge('bmi-gauge', 'شاخص BMI')}
                        </div>
                        <div class="result-card-small">
                             <h4 class="font-semibold text-slate-300 text-sm mb-3 text-center">ماکروهای پیشنهادی (گرم)</h4>
                             <div class="space-y-2 text-xs">
                                <div class="flex justify-between items-center"><span>پروتئین</span><strong id="protein-value">--</strong></div>
                                <div class="macro-bar"><div id="protein-bar" class="macro-bar-inner bg-sky-500" style="width: 0%;"></div></div>
                                <div class="flex justify-between items-center"><span>کربوهیدرات</span><strong id="carbs-value">--</strong></div>
                                <div class="macro-bar"><div id="carbs-bar" class="macro-bar-inner bg-orange-500" style="width: 0%;"></div></div>
                                <div class="flex justify-between items-center"><span>چربی</span><strong id="fat-value">--</strong></div>
                                <div class="macro-bar"><div id="fat-bar" class="macro-bar-inner bg-yellow-500" style="width: 0%;"></div></div>
                             </div>
                        </div>
                    </div>
                </div>
                
                <!-- CTA Button -->
                <div class="text-center pt-8">
                    <button id="get-plan-from-calc-btn" class="primary-button !bg-yellow-400 hover:!bg-yellow-500 !text-black !px-8 !py-2.5 !text-base !rounded-md animate-pulse">دریافت برنامه شخصی‌سازی شده</button>
                </div>
            </div>
        </div>
    </section>
`;

const renderCoachesContent = async () => {
    const allUsers = await getUsers();
    const coachUsernames = ["jafar_zahiri", "morteza_heydari", "hamid_hajati"];
    const coachPromises = coachUsernames.map(async username => {
        const user = allUsers.find(u => u.username === username);
        if(user && user.coachStatus === 'verified') {
            const data = await getUserData(username);
            return { user, data };
        }
        return null;
    });
    
    const coaches = (await Promise.all(coachPromises)).filter(Boolean);

    return `
        <div class="text-center mb-10">
            <h2 class="text-3xl lg:text-4xl font-extrabold text-white">با مربیان متخصص ما آشنا شوید</h2>
            <p class="mt-4 text-slate-400 max-w-2xl mx-auto">
                تیمی از بهترین مربیان کشور که آماده‌اند تا شما را در مسیر رسیدن به اهدافتان همراهی کنند.
            </p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            ${coaches.map((c: any) => {
                const name = c.data.step1?.clientName || c.user.username;
                const specialization = c.data.profile?.specialization || "مربی رسمی بدنسازی";
                const avatar = c.data.profile?.avatar;
                const avatarHtml = avatar
                    ? `<img src="${avatar}" alt="${name}" class="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-slate-700 object-cover">`
                    : `<div class="w-24 h-24 rounded-full mx-auto mb-4 bg-slate-700 flex items-center justify-center font-bold text-3xl">${name.charAt(0)}</div>`;

                return `
                <div class="coach-card-revert">
                    ${avatarHtml}
                    <h3 class="text-xl font-bold text-white">${name}</h3>
                    <p class="text-accent font-semibold text-sm mt-1">${specialization}</p>
                    <div class="flex justify-center gap-4 mt-4 text-slate-400">
                       <a href="#" class="hover:text-white"><i data-lucide="instagram" class="w-5 h-5"></i></a>
                       <a href="#" class="hover:text-white"><i data-lucide="send" class="w-5 h-5"></i></a>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    `;
};

const renderPricingContent = async () => {
    const plans = await getStorePlans();
    if (!plans || plans.length === 0) return '<p class="text-white text-center">پلن‌های قیمت‌گذاری به زودی اعلام خواهند شد.</p>';

    return `
        <div class="text-center mb-10">
            <h2 class="text-3xl lg:text-4xl font-extrabold text-white">تعرفه‌های شفاف و منعطف</h2>
            <p class="mt-4 text-slate-400 max-w-2xl mx-auto">
                پلنی را انتخاب کنید که کاملاً متناسب با اهداف و بودجه شما باشد.
            </p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-start">
            ${plans.map((plan: StorePlan) => `
                <div class="pricing-card ${plan.recommended ? 'recommended' : ''} h-full flex flex-col">
                    ${plan.recommended ? '<div class="recommended-badge">پیشنهادی</div>' : ''}
                    <div class="p-8 flex flex-col flex-grow">
                        <h3 class="text-xl font-bold text-white">${plan.emoji || ''} ${plan.planName}</h3>
                        <p class="text-sm text-slate-400 mt-2 h-10">${plan.description}</p>
                        <div class="my-6">
                            <span class="text-4xl font-extrabold text-white">${formatPrice(plan.price).split(' ')[0]}</span>
                            <span class="text-slate-400">/ تومان</span>
                        </div>
                        <ul class="space-y-3 text-sm text-slate-300 mb-6 flex-grow">
                            ${(plan.features || []).map((feature: string) => `
                                <li class="flex items-center gap-3">
                                    <i data-lucide="check" class="w-5 h-5 text-accent"></i>
                                    <span>${feature}</span>
                                </li>
                            `).join('')}
                        </ul>
                        <button class="select-plan-btn primary-button !bg-accent !text-black w-full !text-base !py-3 !rounded-md mt-auto" data-plan-id="${plan.planId}">انتخاب پلن</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
};

const renderMagazineContent = async () => {
    const articles = await getMagazineArticles();
    if (!articles || articles.length === 0) return '';
    const latestArticles = articles.slice(0, 4); 

    return `
        <div class="text-center mb-10">
            <h2 class="text-3xl lg:text-4xl font-extrabold text-white">آخرین مقالات مجله FitGym Pro</h2>
            <p class="mt-4 text-slate-400 max-w-2xl mx-auto">
                دانش خود را با مقالات علمی و کاربردی در زمینه تناسب اندام، تغذیه و سبک زندگی سالم افزایش دهید.
            </p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            ${latestArticles.map((article) => `
                <a href="#" class="magazine-card-revert group">
                    <img src="${article.imageUrl}" alt="${article.title}" class="w-full h-56 object-cover rounded-t-xl transition-transform duration-300 group-hover:scale-105">
                    <div class="p-6">
                        <p class="text-sm font-semibold text-accent mb-2">${article.category}</p>
                        <h3 class="text-xl font-bold text-white group-hover:text-accent transition-colors">${article.title}</h3>
                        <p class="text-sm text-slate-400 mt-3 line-clamp-3">${article.content.split(' ').slice(0, 30).join(' ')}...</p>
                        <div class="mt-4 pt-4 border-t border-slate-700 text-xs text-slate-500">
                            <span>${timeAgo(article.publishDate)}</span>
                        </div>
                    </div>
                </a>
            `).join('')}
        </div>
    `;
};

const renderContactContent = (settings: SiteSettings) => {
    const { contactInfo, socialMedia } = settings;
    return `
        <div class="text-center text-white/50 text-sm">
            <h2 class="text-3xl lg:text-4xl font-extrabold text-white mb-6">تماس با ما</h2>
            <div class="flex justify-center gap-6 mb-6">
                <a href="${socialMedia.instagram}" target="_blank" rel="noopener noreferrer" class="hover:text-white"><i data-lucide="instagram" class="w-5 h-5"></i></a>
                <a href="${socialMedia.telegram}" target="_blank" rel="noopener noreferrer" class="hover:text-white"><i data-lucide="send" class="w-5 h-5"></i></a>
                <a href="${socialMedia.youtube}" target="_blank" rel="noopener noreferrer" class="hover:text-white"><i data-lucide="youtube" class="w-5 h-5"></i></a>
            </div>
            <p class="mb-1">${contactInfo.address}</p>
            <p>ایمیل: <a href="mailto:${contactInfo.email}" class="hover:text-white">${contactInfo.email}</a> | تلفن: <a href="tel:${contactInfo.phone.replace(/-/g, '')}" class="hover:text-white">${contactInfo.phone}</a></p>
        </div>
    `;
};


export const renderLandingPage = async () => {
    const settings = await getSiteSettings();
    const { siteName, contactInfo, socialMedia } = settings;
    const currentUser = getCurrentUser();
    let authButtonHtml = '';

    if (currentUser) {
        const userData = await getUserData(currentUser);
        const name = userData.step1?.clientName || currentUser;
        authButtonHtml = `
            <div class="relative">
                <button id="user-menu-btn" class="landing-auth-btn">
                    <i data-lucide="user" class="w-4 h-4"></i>
                    <span class="font-semibold">${name}</span>
                    <i id="user-menu-chevron" data-lucide="chevron-down" class="w-4 h-4 transition-transform duration-200"></i>
                </button>
                <div id="user-menu-dropdown" class="absolute left-0 mt-2 w-48 bg-[#1E293B] border border-[#334155] rounded-md shadow-lg py-1 z-20 opacity-0 pointer-events-none transition-opacity duration-200">
                    <button id="go-to-dashboard-btn" class="w-full text-right px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2">
                        <i data-lucide="layout-dashboard" class="w-4 h-4"></i><span>داشبورد من</span>
                    </button>
                    <button id="logout-btn-landing" class="w-full text-right px-4 py-2 text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2">
                        <i data-lucide="log-out" class="w-4 h-4"></i><span>خروج</span>
                    </button>
                </div>
            </div>
        `;
    } else {
        authButtonHtml = `
            <button id="auth-btn-landing" class="landing-auth-btn">
                <i data-lucide="log-in" class="w-4 h-4"></i>
                <span>ورود | ثبت نام</span>
            </button>
        `;
    }


    return `
    <div class="landing-page-revert">
        <div class="hero-section-wrapper">
            <header class="landing-header absolute top-0 left-0 right-0 z-10 py-4">
                 <div class="container mx-auto px-4 flex justify-between items-center">
                    <a href="#" class="text-2xl font-black text-white">${siteName}</a>
                    <nav class="hidden lg:flex items-center gap-6 text-white/80">
                        <button data-modal-target="coaches-modal" class="landing-nav-link">مربیان</button>
                        <button data-modal-target="pricing-modal" class="landing-nav-link">تعرفه</button>
                        <button data-modal-target="magazine-modal" class="landing-nav-link">مجله FitGym Pro</button>
                        <button data-modal-target="contact-modal" class="landing-nav-link">تماس با ما</button>
                    </nav>
                    <div class="flex items-center gap-4">
                        <button id="pwa-install-btn" class="landing-auth-btn !bg-sky-500 hover:!bg-sky-600" style="display: none;">
                            <i data-lucide="download-cloud" class="w-4 h-4"></i>
                            <span>نصب اپ</span>
                        </button>
                        ${authButtonHtml}
                    </div>
                </div>
            </header>
            <main>
                <section class="hero-section text-white text-center">
                     <div class="container mx-auto px-4">
                        <h1 class="text-4xl lg:text-6xl font-extrabold leading-tight animate-fade-in-down" style="position: relative; top: -2cm;">
                           FitGymPro
                        </h1>
                        <p class="mt-6 text-lg text-white/70 max-w-2xl mx-auto animate-fade-in-up animation-delay-200">
                           دیگر نیازی به حدس و خطا نیست. ما با تحلیل دقیق اطلاعات شما، بهترین برنامه تمرینی و غذایی را برایتان طراحی می‌کنیم.
                        </p>
                        <div class="mt-8 animate-fade-in-up animation-delay-400">
                            <p class="font-semibold mb-4">هدف اصلی شما چیست؟</p>
                            <div class="flex justify-center gap-3">
                                <button class="hero-goal-selector" data-goal-value="کاهش وزن">کاهش وزن</button>
                                <button class="hero-goal-selector" data-goal-value="حفظ وزن">حفظ وزن</button>
                                <button class="hero-goal-selector" data-goal-value="افزایش حجم">افزایش حجم</button>
                            </div>
                        </div>
                        <p class="text-sm text-slate-400 mt-8 animate-fade-in-up animation-delay-800">به بیش از ۱۰۰۰ ورزشکار راضی بپیوندید</p>
                    </div>
                </section>
            </main>
        </div>
        <div class="bg-[#0B1222]">
            ${renderCalculator()}
             <footer class="bg-[#101A2E] py-12 border-t border-white/10 mt-16">
                 <div class="container mx-auto px-4 text-center text-white/50 text-sm">
                    <p class="font-bold text-lg mb-4 text-white">${siteName}</p>
                    <div class="flex justify-center gap-6 mb-6">
                        <a href="${socialMedia.instagram}" target="_blank" rel="noopener noreferrer" class="hover:text-white"><i data-lucide="instagram" class="w-5 h-5"></i></a>
                        <a href="${socialMedia.telegram}" target="_blank" rel="noopener noreferrer" class="hover:text-white"><i data-lucide="send" class="w-5 h-5"></i></a>
                        <a href="${socialMedia.youtube}" target="_blank" rel="noopener noreferrer" class="hover:text-white"><i data-lucide="youtube" class="w-5 h-5"></i></a>
                    </div>
                    <p class="mb-1">${contactInfo.address}</p>
                    <p>ایمیل: <a href="mailto:${contactInfo.email}" class="hover:text-white">${contactInfo.email}</a> | تلفن: <a href="tel:${contactInfo.phone.replace(/-/g, '')}" class="hover:text-white">${contactInfo.phone}</a></p>
                    <div class="flex justify-center items-center gap-6 my-8">
                        <a href="https://zarinpal.com/" target="_blank" rel="noopener noreferrer" class="opacity-70 hover:opacity-100 transition-opacity">
                            <img src="https://cdn.zarinpal.com/badges/trustLogo/1.svg" alt="درگاه پرداخت زرین پال" class="h-16">
                        </a>
                        <a href="https://enamad.ir/" target="_blank" rel="noopener noreferrer" class="opacity-70 hover:opacity-100 transition-opacity">
                            <img src="https://cdn.webramz.com/uploads/2021/01/enamad-logo.png" alt="نماد اعتماد الکترونیکی" class="h-20">
                        </a>
                    </div>
                    <p class="mt-6">&copy; ${new Date().getFullYear()} ${siteName}. تمام حقوق محفوظ است.</p>
                </div>
            </footer>
        </div>
    </div>

    <!-- Modals -->
    <div id="pricing-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
        <div class="card w-full max-w-7xl transform scale-95 transition-transform duration-300 relative max-h-[90vh] flex flex-col !bg-[#0B1222] !border-[#334155]">
            <div class="p-4 border-b border-slate-700 flex-shrink-0 text-right"><button class="close-modal-btn secondary-button !p-2 rounded-full !bg-slate-700 hover:!bg-slate-600 !border-slate-600"><i data-lucide="x" class="text-white"></i></button></div>
            <div class="p-8 overflow-y-auto">${await renderPricingContent()}</div>
        </div>
    </div>
    <div id="coaches-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
        <div class="card w-full max-w-5xl transform scale-95 transition-transform duration-300 relative max-h-[90vh] flex flex-col !bg-[#0B1222] !border-[#334155]">
            <div class="p-4 border-b border-slate-700 flex-shrink-0 text-right"><button class="close-modal-btn secondary-button !p-2 rounded-full !bg-slate-700 hover:!bg-slate-600 !border-slate-600"><i data-lucide="x" class="text-white"></i></button></div>
            <div class="p-8 overflow-y-auto">${await renderCoachesContent()}</div>
        </div>
    </div>
    <div id="magazine-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
        <div class="card w-full max-w-5xl transform scale-95 transition-transform duration-300 relative max-h-[90vh] flex flex-col !bg-[#0B1222] !border-[#334155]">
            <div class="p-4 border-b border-slate-700 flex-shrink-0 text-right"><button class="close-modal-btn secondary-button !p-2 rounded-full !bg-slate-700 hover:!bg-slate-600 !border-slate-600"><i data-lucide="x" class="text-white"></i></button></div>
            <div class="p-8 overflow-y-auto">${await renderMagazineContent()}</div>
        </div>
    </div>
    <div id="contact-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
        <div class="card w-full max-w-lg transform scale-95 transition-transform duration-300 relative !bg-[#0B1222] !border-[#334155]">
            <div class="p-4 text-right"><button class="close-modal-btn secondary-button !p-2 rounded-full !bg-slate-700 hover:!bg-slate-600 !border-slate-600"><i data-lucide="x" class="text-white"></i></button></div>
            <div class="p-8 pt-0">${renderContactContent(settings)}</div>
        </div>
    </div>
    `;
};

const updateCalculatorResults = () => {
    const calculator = document.getElementById('fitness-calculator');
    if (!calculator) return;

    const age = parseInt((calculator.querySelector('.age-slider') as HTMLInputElement).value, 10);
    const height = parseInt((calculator.querySelector('.height-slider') as HTMLInputElement).value, 10);
    const weight = parseFloat((calculator.querySelector('.weight-slider') as HTMLInputElement).value);
    const gender = (calculator.querySelector('input[name="gender_calc"]:checked') as HTMLInputElement).value;
    const activityLevel = parseFloat((calculator.querySelector('input[name="activity_level_calc"]:checked') as HTMLInputElement).value);
    const goal = (calculator.querySelector('input[name="goal_calc"]:checked') as HTMLInputElement).value;
    
    const metrics = performMetricCalculations({ age, height, weight, gender, activityLevel });

    // TDEE Gauge
    const tdeeValueEl = document.getElementById('tdee-gauge-value')!;
    const tdeeUnitEl = document.getElementById('tdee-gauge-unit')!;
    const tdeeArc = document.querySelector<SVGCircleElement>('#tdee-gauge-arc')!;
    const tdeeSubInfo = document.getElementById('tdee-gauge-sub-info')!;
    if (metrics && metrics.tdee) {
        tdeeValueEl.textContent = String(Math.round(metrics.tdee));
        tdeeUnitEl.textContent = 'kcal';
        const circumference = 2 * Math.PI * 70; // r=70
        const normalizedTdee = Math.max(0, Math.min(1, (metrics.tdee - 1000) / (4000 - 1000)));
        const offset = circumference * (1 - normalizedTdee);
        tdeeArc.style.strokeDashoffset = String(offset);
        tdeeSubInfo.innerHTML = `کاهش: ~${Math.round(metrics.tdee - 400)} | افزایش: ~${Math.round(metrics.tdee + 300)}`;
    }

    // BMI Gauge
    const bmiValueEl = document.getElementById('bmi-gauge-value')!;
    const bmiUnitEl = document.getElementById('bmi-gauge-unit')!;
    const bmiArc = document.querySelector<SVGCircleElement>('#bmi-gauge-arc')!;
    const bmiSubInfo = document.getElementById('bmi-gauge-sub-info')!;
    if (metrics && metrics.bmi) {
        const bmi = metrics.bmi;
        bmiValueEl.textContent = bmi.toFixed(1);
        const circumference = 2 * Math.PI * 70;
        const normalizedBmi = Math.max(0, Math.min(1, (bmi - 15) / (40 - 15)));
        const offset = circumference * (1 - normalizedBmi);
        bmiArc.style.strokeDashoffset = String(offset);

        let category = 'نرمال';
        let color = '#22c55e'; // green
        if (bmi < 18.5) { category = 'کمبود وزن'; color = '#3b82f6'; } // blue
        else if (bmi >= 25 && bmi < 30) { category = 'اضافه وزن'; color = '#f59e0b'; } // yellow
        else if (bmi >= 30) { category = 'چاقی'; color = '#ef4444'; } // red
        bmiUnitEl.textContent = category;
        bmiUnitEl.style.color = color;
        bmiArc.style.stroke = color;
        bmiSubInfo.innerHTML = `وزن ایده‌آل: <strong>${metrics.idealWeight || '--'}</strong>`;
    }

    // Other Cards
    if (metrics) {
        const macros = calculateMacros(metrics.tdee || 0, weight, goal);
        const totalMacros = macros.protein + macros.carbs + macros.fat;
        document.getElementById('protein-value')!.textContent = `${macros.protein}g`;
        document.getElementById('carbs-value')!.textContent = `${macros.carbs}g`;
        document.getElementById('fat-value')!.textContent = `${macros.fat}g`;
        (document.getElementById('protein-bar')! as HTMLElement).style.width = totalMacros > 0 ? `${(macros.protein / totalMacros) * 100}%` : '0%';
        (document.getElementById('carbs-bar')! as HTMLElement).style.width = totalMacros > 0 ? `${(macros.carbs / totalMacros) * 100}%` : '0%';
        (document.getElementById('fat-bar')! as HTMLElement).style.width = totalMacros > 0 ? `${(macros.fat / totalMacros) * 100}%` : '0%';
    }
};

const handleLandingPageClicks = (e: MouseEvent, goToDashboard: () => void, logoutHandler: () => void) => {
    const target = e.target as HTMLElement;

    const userMenuBtn = target.closest('#user-menu-btn');
    if (userMenuBtn) {
        const dropdown = document.getElementById('user-menu-dropdown');
        const chevron = document.getElementById('user-menu-chevron');

        if (userMenuTimeoutId) {
            clearTimeout(userMenuTimeoutId);
            userMenuTimeoutId = null;
        }

        if (dropdown && chevron) {
            // If it's already open, clicking again should close it.
            if (dropdown.classList.contains('opacity-100')) {
                dropdown.classList.remove('opacity-100', 'pointer-events-auto');
                chevron.classList.remove('rotate-180');
            } else {
                // If it's closed, open it and set the timer.
                dropdown.classList.add('opacity-100', 'pointer-events-auto');
                chevron.classList.add('rotate-180');

                userMenuTimeoutId = window.setTimeout(() => {
                    dropdown.classList.remove('opacity-100', 'pointer-events-auto');
                    chevron.classList.remove('rotate-180');
                    userMenuTimeoutId = null;
                }, 5000);
            }
        }
        return;
    }

    // Modal Triggers
    const modalTrigger = target.closest('[data-modal-target]');
    if (modalTrigger) {
        const modalId = modalTrigger.getAttribute('data-modal-target');
        if (modalId) {
            openModal(document.getElementById(modalId));
        }
        return;
    }

    // Modal Closers
    if (target.classList.contains('modal') || target.closest('.close-modal-btn')) {
        closeModal(target.closest('.modal'));
        return;
    }

    if (target.closest('#auth-btn-landing')) {
        openModal(document.getElementById('auth-modal'));
        switchAuthForm('login');
        return;
    }

    if (target.closest('#go-to-dashboard-btn')) {
        goToDashboard();
        return;
    }

    if (target.closest('#logout-btn-landing')) {
        logoutHandler();
        return;
    }
    
    // Select Plan Button
    const selectPlanBtn = target.closest('.select-plan-btn');
    if (selectPlanBtn) {
        const planId = (selectPlanBtn as HTMLElement).dataset.planId;
        if (planId) {
            sessionStorage.setItem('fitgympro_selected_plan', planId);
            closeModal(selectPlanBtn.closest('.modal'));
            openModal(document.getElementById('auth-modal'));
        }
        return;
    }
    
    // Hero Goal Selector
    const heroGoalBtn = target.closest<HTMLElement>('.hero-goal-selector');
    if (heroGoalBtn) {
        const goalValue = heroGoalBtn.dataset.goalValue;
        const calculatorSection = document.getElementById('fitness-calculator');
        const goalRadio = document.querySelector(`input[name="goal_calc"][value="${goalValue}"]`) as HTMLInputElement;

        if (goalRadio && calculatorSection) {
            goalRadio.checked = true;
            // Manually trigger change event for any listeners
            goalRadio.dispatchEvent(new Event('change', { bubbles: true }));
            calculatorSection.scrollIntoView({ behavior: 'smooth' });
        }
        return;
    }
};

const handleHeaderScroll = () => {
    const header = document.querySelector('.landing-page-revert .landing-header');
    if (header) {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
};

const updateLandingSliderTrack = (slider: HTMLInputElement) => {
    if (!slider) return;
    const min = +slider.min || 0;
    const max = +slider.max || 100;
    const val = (+slider.value || 0);
    const percentage = ((val - min) / (max - min)) * 100;

    const parentContainer = slider.closest('[class*="slider-container-"]');
    let accentColor = 'var(--accent)';
    if (parentContainer) {
        if (parentContainer.classList.contains('slider-container-blue')) accentColor = 'var(--admin-accent-blue)';
        else if (parentContainer.classList.contains('slider-container-green')) accentColor = 'var(--admin-accent-green)';
        else if (parentContainer.classList.contains('slider-container-orange')) accentColor = 'var(--admin-accent-orange)';
    }
    const trackColor = '#334155';
    slider.style.background = `linear-gradient(to right, ${accentColor} ${percentage}%, ${trackColor} ${percentage}%)`;
};

export const initLandingPageListeners = (goToDashboard: () => void, logoutHandler: () => void) => {
    const root = document.getElementById('app-root');
    if (!root) return;
    
    // --- Robust Click Handler ---
    // Remove the old listener if it exists to prevent duplicates.
    if (landingPageClickHandler) {
        root.removeEventListener('click', landingPageClickHandler);
    }
    // Create the new listener with up-to-date function references.
    landingPageClickHandler = (e: MouseEvent) => handleLandingPageClicks(e, goToDashboard, logoutHandler);
    root.addEventListener('click', landingPageClickHandler);

    // --- Robust Scroll Handler ---
    if (headerScrollHandler) {
        window.removeEventListener('scroll', headerScrollHandler);
    }
    headerScrollHandler = handleHeaderScroll;
    window.addEventListener('scroll', headerScrollHandler, { passive: true });
    handleHeaderScroll(); // Call once on init to set the initial state

    const calculator = document.getElementById('fitness-calculator');
    if (!calculator) return;
    
    const sliderGroups = calculator.querySelectorAll<HTMLElement>('.slider-group');
    sliderGroups.forEach(group => {
        const slider = group.querySelector<HTMLInputElement>('input[type="range"]');
        const numberInput = group.querySelector<HTMLInputElement>('input[type="number"]');

        if (slider && numberInput) {
            const syncAndUpdate = () => {
                updateLandingSliderTrack(slider);
                updateCalculatorResults();
            };
            slider.addEventListener('input', () => {
                numberInput.value = slider.step === '0.5' ? parseFloat(slider.value).toFixed(1) : slider.value;
                syncAndUpdate();
            });
            numberInput.addEventListener('input', () => {
                let value = parseFloat(numberInput.value);
                const max = parseFloat(slider.max);
                if (isNaN(value)) return;
                
                if (value > max) {
                    value = max;
                    numberInput.value = slider.step === '0.5' ? value.toFixed(1) : String(max);
                }
                
                slider.value = String(value);
                syncAndUpdate();
            });
            numberInput.addEventListener('blur', () => {
                let value = parseFloat(numberInput.value);
                const min = parseFloat(slider.min);
                if (isNaN(value) || value < min) {
                    numberInput.value = slider.step === '0.5' ? parseFloat(slider.min).toFixed(1) : slider.min;
                    slider.value = slider.min;
                    syncAndUpdate();
                }
            });
        }
    });
    
    const allInputs = calculator.querySelectorAll('input');
    allInputs.forEach(input => {
        input.addEventListener('input', updateCalculatorResults);
        input.addEventListener('change', updateCalculatorResults);
    });

    document.getElementById('get-plan-from-calc-btn')?.addEventListener('click', () => {
        const data = {
            age: (calculator.querySelector('.age-slider') as HTMLInputElement).value,
            height: (calculator.querySelector('.height-slider') as HTMLInputElement).value,
            weight: (calculator.querySelector('.weight-slider') as HTMLInputElement).value,
            gender: (calculator.querySelector('input[name="gender_calc"]:checked') as HTMLInputElement).value,
            activityLevel: (calculator.querySelector('input[name="activity_level_calc"]:checked') as HTMLInputElement).value,
            trainingGoal: (calculator.querySelector('input[name="goal_calc"]:checked') as HTMLInputElement).value
        };
        sessionStorage.setItem('fitgympro_calculator_data', JSON.stringify(data));
        openModal(document.getElementById('auth-modal'));
        switchAuthForm('signup');
    });

    calculator.querySelectorAll<HTMLInputElement>('input[type="range"].calculator-slider').forEach(updateLandingSliderTrack);
    updateCalculatorResults();
};