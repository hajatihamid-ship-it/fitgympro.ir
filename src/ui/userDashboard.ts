import { getUserData, saveUserData, addActivityLog, getCart, saveCart, getDiscounts, getNotifications, clearNotification, setNotification, getStorePlans, getUsers } from '../services/storage';
import { getTodayWorkoutData, calculateBodyMetrics, calculateWorkoutStreak, performMetricCalculations, findBestLifts, calculateWeeklyMetrics, getWorkoutsThisWeek } from '../utils/calculations';
import { showToast, updateSliderTrack, openModal, closeModal, exportElement, hexToRgba } from '../utils/dom';
import { generateNutritionPlan } from '../services/gemini';
import { sanitizeHTML } from '../utils/dom';
import { formatPrice, timeAgo, getLatestSubscription, getUserAccessPermissions, canUserChat } from '../utils/helpers';

let selectedCoachInModal: string | null = null;
let progressChartInstance: any = null;


// FIX: Make function async to await getUserData
const checkProfileFormValidity = async (currentUser: string) => {
    const form = document.getElementById('user-profile-form');
    const submitBtn = document.getElementById('profile-submit-btn');
    if (!form || !submitBtn) return;

    const name = (form.querySelector('#user-profile-name') as HTMLInputElement)?.value.trim();
    // FIX: await async function getUserData
    const coachIsSelected = !!((await getUserData(currentUser)).step1?.coachName || selectedCoachInModal);
    const gender = (form.querySelector('input[name="gender_user"]:checked') as HTMLInputElement)?.value;
    const goal = (form.querySelector('input[name="training_goal_user"]:checked') as HTMLInputElement)?.value;
    const days = (form.querySelector('input[name="training_days_user"]:checked') as HTMLInputElement)?.value;
    const activity = (form.querySelector('input[name="activity_level_user"]:checked') as HTMLInputElement)?.value;

    const isValid = !!(name && name.length > 0 && coachIsSelected && gender && goal && days && activity);

    (submitBtn as HTMLButtonElement).disabled = !isValid;
};


export async function renderUserDashboard(currentUser: string, userData: any) {
    const name = userData.step1?.clientName || currentUser;
    const coachData = userData.step1?.coachName ? await getUserData(userData.step1.coachName) : null;
    const coachName = coachData?.step1?.clientName || userData.step1?.coachName || 'بدون مربی';
    const avatarUrl = userData.profile?.avatar;

    const navItems = [
        { target: 'dashboard-content', icon: 'layout-dashboard', label: 'داشبورد', color: 'var(--admin-accent-blue)' },
        { target: 'program-content', icon: 'clipboard-list', label: 'برنامه من', color: 'var(--admin-accent-green)' },
        { target: 'nutrition-content', icon: 'utensils-crossed', label: 'برنامه تغذیه', color: 'var(--admin-accent-orange)' },
        { target: 'chat-content', icon: 'message-square', label: 'گفتگو با مربی', color: 'var(--admin-accent-pink)' },
        { target: 'store-content', icon: 'shopping-cart', label: 'فروشگاه', color: 'var(--admin-accent-red)' },
        { target: 'profile-content', icon: 'user', label: 'پروفایل', color: 'var(--admin-accent-gray)' },
        { target: 'help-content', icon: 'help-circle', label: 'راهنما', color: 'var(--admin-accent-yellow)' }
    ];

    const hasAccess = (permission: string) => {
        if (permission === 'chat') {
            return canUserChat(userData).canChat;
        }
        const permissions = getUserAccessPermissions(userData);
        return permissions.has(permission);
    };

    const avatarHtml = avatarUrl
        ? `<img src="${avatarUrl}" alt="${name}" class="w-10 h-10 rounded-full object-cover">`
        : `<div class="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-lg text-bg-secondary" style="background-color: var(--accent);">
               ${name.substring(0, 1).toUpperCase()}
           </div>`;

    return `
    <div id="user-dashboard-container" class="lg:flex h-screen bg-bg-primary transition-opacity duration-500 opacity-0">
        <aside class="fixed inset-y-0 right-0 z-40 w-64 bg-bg-secondary p-4 flex flex-col flex-shrink-0 border-l border-border-primary transform translate-x-full transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0">
            <div class="flex items-center gap-3 p-2 mb-6">
                <i data-lucide="dumbbell" class="w-8 h-8 text-accent"></i>
                <h1 class="text-xl font-bold">FitGym Pro</h1>
            </div>
            <nav class="space-y-2 flex-grow">
                ${navItems.map(item => {
                    const requiresWorkoutPlan = item.target === 'program-content';
                    const requiresNutrition = item.target === 'nutrition-content';
                    const requiresChat = item.target === 'chat-content';

                    let isLocked = false;
                    if (requiresWorkoutPlan && !hasAccess('workout_plan')) {
                        isLocked = true;
                    }
                    if (requiresNutrition && !hasAccess('nutrition_plan')) {
                        isLocked = true;
                    }
                    if (requiresChat && !hasAccess('chat')) {
                        isLocked = true;
                    }

                    // The help section is never locked
                    if (item.target === 'help-content') {
                        isLocked = false;
                    }

                    return `
                    <button class="coach-nav-link w-full flex items-center gap-3 py-3 rounded-lg text-md ${isLocked ? 'locked-feature' : ''}" 
                            data-target="${item.target}" 
                            ${isLocked ? 'title="برای دسترسی، پلن خود را ارتقا دهید"' : ''} 
                            style="--nav-item-color: ${item.color};">
                        <i data-lucide="${item.icon}" class="w-5 h-5"></i>
                        <span>${item.label}</span>
                        ${isLocked ? '<i data-lucide="lock" class="w-4 h-4 lock-icon mr-auto"></i>' : '<span class="notification-badge mr-auto"></span>'}
                    </button>
                    `;
                }).join('')}
            </nav>
            <div class="space-y-2">
                 <button id="go-to-home-btn" class="secondary-button w-full !justify-start !gap-3 !px-4 !py-3"><i data-lucide="home" class="w-5 h-5"></i><span>صفحه اصلی</span></button>
                 <div id="theme-switcher" class="bg-bg-tertiary rounded-xl p-1 relative flex items-center justify-around">
                    <div id="theme-glider"></div>
                    <button data-theme="lemon" class="theme-option-btn flex-1 py-2 px-4 z-10 rounded-lg">روشن</button>
                    <button data-theme="dark" class="theme-option-btn flex-1 py-2 px-4 z-10 rounded-lg">تاریک</button>
                </div>
                 <button id="logout-btn" class="secondary-button w-full !justify-start !gap-3 !px-4 !py-3"><i data-lucide="log-out" class="w-5 h-5"></i><span>خروج</span></button>
            </div>
        </aside>

        <main class="flex-1 p-6 lg:p-8 overflow-y-auto">
            <div id="global-user-notification-placeholder"></div>
            <div id="impersonation-banner-placeholder"></div>
            <header class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <div class="flex items-center gap-2">
                     <button id="sidebar-toggle" class="lg:hidden p-2 -mr-2 text-text-secondary hover:text-text-primary">
                        <i data-lucide="menu" class="w-6 h-6"></i>
                    </button>
                    <div id="user-page-title-container">
                        <h1 id="user-page-title" class="text-3xl font-bold">داشبورد</h1>
                        <p id="user-page-subtitle" class="text-text-secondary">خلاصه فعالیت‌ها و پیشرفت شما.</p>
                    </div>
                </div>
                 <div class="flex items-center gap-3">
                    <button id="header-cart-btn" class="relative secondary-button !p-2 rounded-full mr-2">
                        <i data-lucide="shopping-cart" class="w-5 h-5"></i>
                        <span id="header-cart-badge" class="notification-badge -top-1 -right-1 !w-5 !h-5 !text-xs hidden">0</span>
                    </button>
                    <div class="flex items-center gap-3 bg-bg-secondary p-2 rounded-lg">
                        ${avatarHtml}
                        <div>
                            <p class="font-bold text-sm">${name}</p>
                            <p class="text-xs text-text-secondary">مربی: ${coachName}</p>
                        </div>
                    </div>
                </div>
            </header>

            <div id="dashboard-content" class="user-tab-content hidden"></div>
            <div id="program-content" class="user-tab-content hidden"></div>
            <div id="nutrition-content" class="user-tab-content hidden"></div>
            <div id="chat-content" class="user-tab-content hidden"></div>
            <div id="store-content" class="user-tab-content hidden"></div>
            <div id="profile-content" class="user-tab-content hidden"></div>
            <div id="help-content" class="user-tab-content hidden"></div>
        </main>
        
        <div id="user-dashboard-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
            <div class="card w-full max-w-2xl transform scale-95 transition-transform duration-300 relative max-h-[90vh] flex flex-col">
                <div class="flex justify-between items-center p-4 border-b border-border-primary flex-shrink-0">
                    <h2 id="user-modal-title" class="font-bold text-xl"></h2>
                    <button id="close-user-modal-btn" class="secondary-button !p-2 rounded-full"><i data-lucide="x"></i></button>
                </div>
                <div id="user-modal-body" class="p-6 overflow-y-auto">
                    <!-- Content injected by JS -->
                </div>
            </div>
        </div>
         <div id="cart-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
            <div class="card w-full max-w-lg transform scale-95 transition-transform duration-300 relative max-h-[90vh] flex flex-col">
                <div class="flex justify-between items-center p-4 border-b border-border-primary flex-shrink-0">
                    <h2 class="font-bold text-xl">سبد خرید</h2>
                    <button id="close-cart-modal-btn" class="secondary-button !p-2 rounded-full"><i data-lucide="x"></i></button>
                </div>
                <div id="cart-modal-body" class="p-6 overflow-y-auto flex-grow">
                    <!-- Cart content injected by JS -->
                </div>
                <div class="p-4 border-t border-border-primary bg-bg-tertiary/50 rounded-b-xl flex-shrink-0">
                    <div class="flex items-center gap-2 mb-4">
                        <input type="text" id="discount-code-input-modal" class="input-field flex-grow !text-sm" placeholder="کد تخفیف">
                        <button id="apply-discount-btn-modal" class="secondary-button !text-sm">اعمال</button>
                    </div>
                    <button id="checkout-btn-modal" class="primary-button w-full">پرداخت</button>
                </div>
            </div>
        </div>
    </div>
    `;
}

export const updateUserNotifications = async (currentUser: string) => {
    const notifications = await getNotifications(currentUser);
    const dashboardContainer = document.getElementById('user-dashboard-container');
    if (!dashboardContainer) return;

    dashboardContainer.querySelectorAll('.coach-nav-link').forEach(tab => {
        const targetId = tab.getAttribute('data-target');
        const badge = tab.querySelector('.notification-badge') as HTMLElement;
        if (!targetId || !badge) return;

        if (notifications[targetId]) {
            badge.textContent = notifications[targetId];
            if (!badge.classList.contains('visible')) {
                badge.classList.add('visible');
            }
        } else {
            badge.classList.remove('visible');
        }
    });
};

const renderUnifiedProgramView = (userData: any) => {
    const container = document.getElementById('program-content');
    if (!container) return;

    const latestProgram = (userData.programHistory && userData.programHistory.length > 0)
        ? userData.programHistory[0]
        : (userData.step2 ? { date: userData.joinDate, step2: userData.step2, supplements: userData.supplements || [] } : null);

    const hasProgram = latestProgram && latestProgram.step2 && latestProgram.step2.days && latestProgram.step2.days.some((d: any) => d.exercises && d.exercises.length > 0);

    if (!hasProgram) {
        container.innerHTML = `<div class="card p-8 text-center text-text-secondary"><i data-lucide="folder-x" class="w-12 h-12 mx-auto mb-4"></i><p>هنوز برنامه‌ای برای شما ثبت نشده است. مربی شما به زودی برنامه را ارسال خواهد کرد.</p></div>`;
        window.lucide?.createIcons();
        return;
    }

    const { step1: student } = userData;
    const { step2: workout, supplements } = latestProgram;
    const dayColors = ['#3b82f6', '#ef4444', '#f97316', '#10b981', '#a855f7', '#ec4899', '#f59e0b'];

    container.innerHTML = `
        <div class="program-page mx-auto bg-bg-secondary rounded-xl shadow-lg" id="unified-program-view">
             <div class="watermark-text-overlay">FitGym Pro</div>
             <div class="p-4 md:p-8">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold">برنامه اختصاصی FitGym Pro</h2>
                    <p class="font-semibold">${new Date(latestProgram.date || Date.now()).toLocaleDateString('fa-IR')}</p>
                </div>

                <h3 class="preview-section-header"><i data-lucide="user-check"></i> اطلاعات شما</h3>
                <div class="preview-vitals-grid">
                    <div><span>نام:</span> <strong>${student.clientName || 'N/A'}</strong></div>
                    <div><span>هدف:</span> <strong>${student.trainingGoal || 'N/A'}</strong></div>
                    <div><span>سن:</span> <strong>${student.age || 'N/A'}</strong></div>
                    <div><span>قد:</span> <strong>${student.height || 'N/A'} cm</strong></div>
                    <div><span>وزن:</span> <strong>${student.weight || 'N/A'} kg</strong></div>
                    <div><span>TDEE:</span> <strong>${student.tdee ? Math.round(student.tdee) : 'N/A'} kcal</strong></div>
                </div>

                <h3 class="preview-section-header mt-6"><i data-lucide="clipboard-list"></i> برنامه تمرینی</h3>
                <div class="space-y-4">
                ${(workout.days || []).filter((d: any) => d.exercises && d.exercises.length > 0).map((day: any, index: number) => `
                    <div>
                         <h4 class="font-bold mb-2 p-2 rounded-md" style="border-right: 4px solid ${dayColors[index % dayColors.length]}; background-color: ${hexToRgba(dayColors[index % dayColors.length], 0.1)};">${day.name}</h4>
                        <table class="preview-table-pro">
                            <thead><tr><th>حرکت</th><th>ست</th><th>تکرار</th><th>استراحت</th></tr></thead>
                            <tbody>
                            ${(day.exercises || []).map((ex: any) => `<tr class="${ex.is_superset ? 'superset-group-pro' : ''}"><td>${ex.name}</td><td>${ex.sets}</td><td>${ex.reps}</td><td>${ex.rest}s</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                `).join('')}
                </div>
                
                ${supplements && supplements.length > 0 ? `
                <h3 class="preview-section-header mt-6"><i data-lucide="pill"></i> برنامه مکمل</h3>
                <table class="preview-table-pro">
                    <thead><tr><th>مکمل</th><th>دوز</th><th>زمان</th><th>یادداشت</th></tr></thead>
                    <tbody>
                        ${supplements.map((sup: any) => `<tr><td>${sup.name}</td><td>${sup.dosage}</td><td>${sup.timing}</td><td>${sup.notes || '-'}</td></tr>`).join('')}
                    </tbody>
                </table>
                ` : ''}

                ${workout.notes ? `
                <h3 class="preview-section-header mt-6"><i data-lucide="file-text"></i> یادداشت مربی</h3>
                <div class="preview-notes-pro">${workout.notes.replace(/\n/g, '<br>')}</div>
                ` : ''}
                
                <footer class="page-footer">ارائه شده توسط FitGym Pro - مربی شما: ${student.coachName || 'مربی'}</footer>
            </div>
        </div>
        <div class="flex justify-center items-center gap-4 mt-6">
            <button id="save-program-img-btn" class="png-button"><i data-lucide="image" class="w-4 h-4 ml-2"></i> ذخیره عکس</button>
            <button id="save-program-pdf-btn" class="pdf-button"><i data-lucide="file-down" class="w-4 h-4 ml-2"></i> ذخیره PDF</button>
        </div>
    `;

    window.lucide.createIcons();
};

const openWorkoutLogModal = (dayData: any, dayIndex: number, currentUser: string) => {
    const modal = document.getElementById('user-dashboard-modal');
    const titleEl = document.getElementById('user-modal-title');
    const bodyEl = document.getElementById('user-modal-body');
    if (!modal || !titleEl || !bodyEl) return;

    titleEl.textContent = `ثبت تمرین: ${dayData.name}`;

    let bodyHtml = `<form id="workout-log-form" data-day-index="${dayIndex}" class="space-y-4">`;
    (dayData.exercises || []).forEach((ex: any, exIndex: number) => {
        const template = document.getElementById('exercise-log-template') as HTMLTemplateElement;
        const exerciseNode = template.content.cloneNode(true) as DocumentFragment;
        
        (exerciseNode.querySelector('h4') as HTMLElement).textContent = ex.name;
        
        const setsContainer = exerciseNode.querySelector('.sets-log-container') as HTMLElement;
        setsContainer.innerHTML = ''; // Clear template content
        
        for (let i = 0; i < ex.sets; i++) {
            const setTemplate = document.getElementById('set-log-row-template') as HTMLTemplateElement;
            const setNode = setTemplate.content.cloneNode(true) as DocumentFragment;
            (setNode.querySelector('.font-semibold') as HTMLElement).textContent = `ست ${i + 1}`;
            (setNode.querySelector('.reps-log-input') as HTMLInputElement).placeholder = `تکرار (${ex.reps})`;
             (setNode.querySelector('.add-set-btn') as HTMLButtonElement).style.display = 'none';

            setsContainer.appendChild(setNode);
        }
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(exerciseNode);
        bodyHtml += tempDiv.innerHTML;
    });
    bodyHtml += `<button type="submit" class="primary-button w-full mt-4">ذخیره و پایان تمرین</button></form>`;
    bodyEl.innerHTML = bodyHtml;
    
    openModal(modal);
    window.lucide?.createIcons();
};

const getPlanStatus = (userData: any) => {
    const latestSub = getLatestSubscription(userData);
    if (!latestSub) {
        return null;
    }

    const planId = latestSub.planId;
    const purchaseDate = new Date(latestSub.purchaseDate);
    
    let durationInMonths = 0;
    if (planId.includes('-1m')) durationInMonths = 1;
    else if (planId.includes('-3m')) durationInMonths = 3;
    else if (planId.includes('-6m')) durationInMonths = 6;
    
    if (durationInMonths === 0) return null;

    const totalDurationInDays = durationInMonths * 30;
    const endDate = new Date(purchaseDate);
    endDate.setDate(purchaseDate.getDate() + totalDurationInDays);

    const today = new Date();
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining < 0) return null;

    const daysPassed = totalDurationInDays - daysRemaining;
    const progressPercentage = Math.min(100, Math.max(0, (daysPassed / totalDurationInDays) * 100));

    return {
        planName: latestSub.planName,
        daysRemaining,
        progressPercentage,
    };
};

const renderDashboardTab = (currentUser: string, userData: any) => {
    const dashboardContentEl = document.getElementById('dashboard-content');
    if (!dashboardContentEl) return;

    const name = userData.step1?.clientName || currentUser;
    const streak = calculateWorkoutStreak(userData.workoutHistory);
    const totalWorkouts = (userData.workoutHistory || []).length;
    
    const weightHistory = userData.weightHistory || [];
    const lastWeight = weightHistory.length > 0 ? weightHistory.slice(-1)[0].weight : (userData.step1?.weight || 0);
    const firstWeight = weightHistory.length > 0 ? weightHistory[0].weight : null;
    const weightChange = (lastWeight && firstWeight) ? (lastWeight - firstWeight).toFixed(1) : 0;

    const workoutsThisWeek = getWorkoutsThisWeek(userData.workoutHistory);
    const weeklyGoal = userData.step1?.trainingDays || 4;
    const weeklyProgress = weeklyGoal > 0 ? Math.min(100, (workoutsThisWeek / weeklyGoal) * 100) : 0;
    const weeklyRingCircumference = 2 * Math.PI * 28;
    const weeklyRingOffset = weeklyRingCircumference * (1 - (weeklyProgress / 100));

    const todayData = getTodayWorkoutData(userData);
    let todayWorkoutHtml = `
        <div class="card p-6 text-center h-full flex flex-col justify-center items-center">
            <div class="w-20 h-20 bg-bg-tertiary rounded-full mx-auto flex items-center justify-center mb-4">
                 <i data-lucide="coffee" class="w-10 h-10 text-accent"></i>
            </div>
            <h4 class="font-bold text-lg">امروز روز استراحت است</h4>
            <p class="text-sm text-text-secondary mt-1">از ریکاوری و رشد عضلات لذت ببرید!</p>
        </div>
    `;
    if (todayData && todayData.day.exercises.length > 0) {
        todayWorkoutHtml = `
            <div class="card p-6 h-full flex flex-col">
                <h3 class="font-bold text-lg mb-4">تمرین امروز: <span class="text-accent">${todayData.day.name.split(':')[1]?.trim() || ''}</span></h3>
                <div class="p-4 rounded-xl bg-bg-tertiary flex-grow">
                    <ul class="space-y-2 text-sm">
                    ${todayData.day.exercises.slice(0, 4).map((ex: any) => `<li class="flex items-center gap-2"><i data-lucide="check" class="w-4 h-4 text-accent"></i> ${ex.name}</li>`).join('')}
                    ${todayData.day.exercises.length > 4 ? `<li class="text-text-secondary mt-2">+ ${todayData.day.exercises.length - 4} حرکت دیگر...</li>` : ''}
                    </ul>
                </div>
                <button class="primary-button w-full mt-6" data-action="log-workout" data-day-index="${todayData.dayIndex}">
                    <i data-lucide="play-circle" class="w-5 h-5 mr-2"></i>
                    ثبت تمرین امروز
                </button>
            </div>
        `;
    }

    const bestLifts = findBestLifts(userData.workoutHistory, ["اسکوات با هالتر", "پرس سینه هالتر", "ددلیفت"]);

    dashboardContentEl.innerHTML = `
        <div class="space-y-6">
            <div class="today-focus-card">
                <h2 class="text-3xl font-bold text-white">سلام، ${name}!</h2>
                <p class="text-white/80">خوش آمدید! بیایید روز خود را با قدرت شروع کنیم.</p>
            </div>
            
            <div class="dashboard-grid">
                <div class="dashboard-main-col space-y-6">
                    <div class="animate-fade-in-up" style="animation-delay: 200ms;">
                        ${todayWorkoutHtml}
                    </div>

                    <div class="card p-6 animate-fade-in-up" style="animation-delay: 400ms;">
                        <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
                            <h3 class="font-bold text-lg">گزارش پیشرفت</h3>
                            <div id="progress-chart-tabs" class="flex items-center gap-1 bg-bg-tertiary p-1 rounded-lg self-start sm:self-center">
                                <button class="progress-tab-btn admin-tab-button !py-1 !px-3 !text-xs active-tab" data-chart="weight">روند وزن</button>
                                <button class="progress-tab-btn admin-tab-button !py-1 !px-3 !text-xs" data-chart="volume">حجم تمرین</button>
                                <button class="progress-tab-btn admin-tab-button !py-1 !px-3 !text-xs" data-chart="frequency">دفعات تمرین</button>
                            </div>
                        </div>
                        <div class="chart-container h-64 md:h-80"><canvas id="user-progress-chart"></canvas></div>
                    </div>
                </div>
                <div class="dashboard-side-col space-y-6">
                    <div class="grid grid-cols-2 gap-6">
                        <div class="stat-card animate-fade-in-up" style="animation-delay: 300ms;">
                            <div class="icon-container" style="--icon-bg: var(--admin-accent-pink);"><i data-lucide="flame" class="w-6 h-6 text-white"></i></div>
                            <div>
                                <p class="stat-value">${streak}</p>
                                <p class="stat-label">زنجیره تمرین</p>
                            </div>
                        </div>
                         <div class="stat-card animate-fade-in-up" style="animation-delay: 400ms;">
                             <div class="icon-container" style="--icon-bg: var(--admin-accent-blue);"><i data-lucide="dumbbell" class="w-6 h-6 text-white"></i></div>
                            <div>
                                <p class="stat-value">${totalWorkouts}</p>
                                <p class="stat-label">کل تمرینات</p>
                            </div>
                        </div>
                    </div>
                    <div class="stat-card animate-fade-in-up" style="animation-delay: 500ms;">
                        <div class="progress-ring" style="width: 70px; height: 70px;">
                            <svg class="progress-ring-svg" viewBox="0 0 64 64">
                                <circle class="progress-ring-track" r="28" cx="32" cy="32" stroke-width="8"></circle>
                                <circle class="progress-ring-value" r="28" cx="32" cy="32" stroke-width="8" style="stroke:var(--accent); stroke-dasharray: ${weeklyRingCircumference}; stroke-dashoffset: ${weeklyRingOffset};"></circle>
                            </svg>
                            <span class="absolute font-bold text-sm">${workoutsThisWeek}/${weeklyGoal}</span>
                        </div>
                        <div class="flex-grow">
                             <p class="stat-value -mb-1">${weeklyProgress.toFixed(0)}<span class="text-xl">%</span></p>
                             <p class="stat-label">پیشرفت هفتگی</p>
                        </div>
                    </div>
                    <div class="stat-card animate-fade-in-up" style="animation-delay: 600ms;">
                         <div class="icon-container" style="--icon-bg: var(--admin-accent-green);"><i data-lucide="weight" class="w-6 h-6 text-white"></i></div>
                        <div>
                            <p class="stat-value">${lastWeight} <span class="text-base font-normal">kg</span></p>
                            <p class="stat-label">وزن فعلی (<span class="${Number(weightChange) >= 0 ? 'text-green-500' : 'text-red-500'}">${Number(weightChange) >= 0 ? '+' : ''}${weightChange} kg</span>)</p>
                        </div>
                    </div>

                    <div class="card p-6 animate-fade-in-up" style="animation-delay: 700ms;">
                        <h3 class="font-bold text-lg mb-2">رکوردهای شخصی</h3>
                        <div class="space-y-2">
                           ${bestLifts.map(lift => `
                                <div class="record-item">
                                    <div>
                                        <p class="exercise-name">${lift.exerciseName}</p>
                                        ${lift.date ? `<p class="record-date">${new Date(lift.date).toLocaleDateString('fa-IR')}</p>` : ''}
                                    </div>
                                    ${lift.weight ? `<p class="record-value">${lift.weight}kg x ${lift.reps}</p>` : `<p class="text-sm text-text-secondary">ثبت نشده</p>`}
                                </div>
                           `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    window.lucide?.createIcons();
    initDashboardCharts(userData);
};

const renderProgressChart = (chartType: string, userData: any) => {
    const ctx = document.getElementById('user-progress-chart') as HTMLCanvasElement;
    if (!ctx) return;

    if (progressChartInstance) {
        progressChartInstance.destroy();
    }
    
    const isDark = document.documentElement.dataset.theme === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: {
                display: true, text: '',
                color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(),
                font: { family: 'Vazirmatn, sans-serif', weight: 'bold' }
            }
        },
        scales: {
            x: {
                grid: { color: gridColor },
                ticks: { color: textColor, font: { family: 'Vazirmatn, sans-serif' } }
            },
            y: {
                grid: { color: gridColor },
                ticks: { color: textColor, font: { family: 'Vazirmatn, sans-serif' } }
            }
        }
    };

    const weeklyMetrics = calculateWeeklyMetrics(userData.workoutHistory);
    const weightHistory = userData.weightHistory || [];
    let chartConfig: any;
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const blueColor = getComputedStyle(document.documentElement).getPropertyValue('--admin-accent-blue').trim();
    const orangeColor = getComputedStyle(document.documentElement).getPropertyValue('--admin-accent-orange').trim();

    switch (chartType) {
        case 'weight':
            chartConfig = {
                type: 'line',
                data: {
                    labels: weightHistory.map((d: any) => new Date(d.date).toLocaleDateString('fa-IR')),
                    datasets: [{
                        label: 'وزن (کیلوگرم)',
                        data: weightHistory.map((d: any) => d.weight),
                        borderColor: accentColor,
                        backgroundColor: hexToRgba(accentColor, 0.2),
                        fill: true, tension: 0.3, pointRadius: 2,
                    }]
                },
                options: { ...commonOptions }
            };
            chartConfig.options.plugins.title.text = 'روند تغییر وزن (کیلوگرم)';
            break;
        case 'volume':
             chartConfig = {
                type: 'bar',
                data: {
                    labels: weeklyMetrics.labels,
                    datasets: [{
                        label: 'حجم (کیلوگرم)',
                        data: weeklyMetrics.volumes,
                        backgroundColor: hexToRgba(blueColor, 0.7),
                        borderColor: blueColor,
                        borderWidth: 1, borderRadius: 4
                    }]
                },
                options: { ...commonOptions }
            };
            chartConfig.options.plugins.title.text = 'حجم تمرین هفتگی (کیلوگرم)';
            break;
        case 'frequency':
            chartConfig = {
                type: 'bar',
                data: {
                    labels: weeklyMetrics.labels,
                    datasets: [{
                        label: 'تعداد تمرینات',
                        data: weeklyMetrics.frequencies,
                        backgroundColor: hexToRgba(orangeColor, 0.7),
                        borderColor: orangeColor,
                        borderWidth: 1, borderRadius: 4
                    }]
                },
                 options: { ...commonOptions }
            };
            chartConfig.options.plugins.title.text = 'تعداد تمرینات در هفته';
            chartConfig.options.scales.y.ticks = { ...chartConfig.options.scales.y.ticks, stepSize: 1 };
            break;
    }

    if (chartConfig) {
        progressChartInstance = new window.Chart(ctx, chartConfig);
    }
};

const initDashboardCharts = (userData: any) => {
    renderProgressChart('weight', userData);
};

// FIX: Make function async to await getCart() and getDiscounts()
const renderCartModalContentAndBadge = async (currentUser: string) => {
    // 1. Update Badge
    const cart = await getCart(currentUser);
    const badge = document.getElementById('header-cart-badge');
    if (badge) {
        if (cart.items.length > 0) {
            badge.textContent = String(cart.items.length);
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    // 2. Update Modal Content
    const cartContainer = document.getElementById('cart-modal-body');
    const checkoutBtn = document.getElementById('checkout-btn-modal');
    if (!cartContainer || !checkoutBtn) return;

    if (cart.items.length === 0) {
        cartContainer.innerHTML = '<p class="text-text-secondary text-center py-8">سبد خرید شما خالی است.</p>';
        checkoutBtn.setAttribute('disabled', 'true');
        return;
    }

    const subtotal = cart.items.reduce((sum: number, item: any) => sum + item.price, 0);
    const discounts = await getDiscounts();
    let discountAmount = 0;
    let finalTotal = subtotal;

    if (cart.discountCode && discounts[cart.discountCode]) {
        const discount = discounts[cart.discountCode];
        if (discount.type === 'percentage') {
            discountAmount = subtotal * (discount.value / 100);
        } else {
            discountAmount = discount.value;
        }
        finalTotal = Math.max(0, subtotal - discountAmount);
    }

    cartContainer.innerHTML = `
        <div class="space-y-3">
            ${cart.items.map((item: any) => `
                <div class="flex justify-between items-center text-sm p-2 bg-bg-tertiary rounded-md">
                    <div>
                        <p class="font-semibold">${item.planName}</p>
                        <span class="font-bold text-accent">${formatPrice(item.price)}</span>
                    </div>
                    <button class="remove-from-cart-btn text-red-accent hover:text-red-500" data-plan-id="${item.planId}"><i class="w-4 h-4 pointer-events-none" data-lucide="trash-2"></i></button>
                </div>
            `).join('')}
        </div>
        <div class="border-t border-border-primary mt-4 pt-4 space-y-2">
            <div class="flex justify-between text-sm">
                <span>جمع کل:</span>
                <span>${formatPrice(subtotal)}</span>
            </div>
            ${discountAmount > 0 ? `
            <div class="flex justify-between text-sm text-green-500">
                <span>تخفیف (${cart.discountCode}):</span>
                <span>- ${formatPrice(discountAmount)}</span>
            </div>
            ` : ''}
            <div class="flex justify-between font-bold text-lg mt-2">
                <span>مبلغ قابل پرداخت:</span>
                <span>${formatPrice(finalTotal)}</span>
            </div>
        </div>
    `;
    checkoutBtn.removeAttribute('disabled');
    window.lucide?.createIcons();
};


const renderStoreTab = async (currentUser: string) => {
    const container = document.getElementById('store-content');
    if (!container) return;
    const plans = await getStorePlans();
    const userData = await getUserData(currentUser);
    const hasCoach = !!userData.step1?.coachName;
    
    container.innerHTML = `
        ${!hasCoach ? `
            <div class="info-card !bg-admin-accent-yellow/10 !border-admin-accent-yellow p-4 mb-6 flex items-center gap-3">
                <i data-lucide="alert-triangle" class="w-6 h-6 text-admin-accent-yellow"></i>
                <div>
                    <h4 class="font-bold text-admin-accent-yellow">پروفایل شما ناقص است</h4>
                    <p class="text-sm text-yellow-700 dark:text-yellow-300">برای خرید پلن، ابتدا باید مربی خود را از بخش <button class="font-bold underline" id="go-to-profile-from-store">پروفایل</button> انتخاب کنید.</p>
                </div>
            </div>
        ` : ''}
        <div class="space-y-6">
            <div>
                <h3 class="font-bold text-xl mb-4">پلن‌های موجود</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${plans.map((plan: any) => {
                        const buttonState = hasCoach ? '' : 'disabled';
                        const buttonClasses = hasCoach ? '' : 'opacity-50 cursor-not-allowed';
                        return `
                        <div class="card p-6 flex flex-col border-2 transition-all hover:shadow-xl hover:-translate-y-1" style="border-color: ${plan.color || 'var(--border-primary)'};">
                            <h4 class="text-lg font-bold text-text-primary">${plan.emoji || ''} ${plan.planName}</h4>
                            <p class="text-sm text-text-secondary mt-1 flex-grow">${plan.description}</p>
                            <div class="my-6">
                                <span class="text-3xl font-black">${formatPrice(plan.price).split(' ')[0]}</span>
                                <span class="text-text-secondary"> تومان</span>
                            </div>
                            <ul class="space-y-3 text-sm mb-6">
                                ${(plan.features || []).map((feature: string) => `
                                    <li class="flex items-center gap-2">
                                        <i data-lucide="check-circle" class="w-5 h-5 text-green-400"></i>
                                        <span>${feature}</span>
                                    </li>
                                `).join('')}
                            </ul>
                            <button class="add-to-cart-btn primary-button mt-auto w-full ${buttonClasses}" data-plan-id='${plan.planId}' ${buttonState} title="${!hasCoach ? 'ابتدا مربی خود را انتخاب کنید' : 'افزودن به سبد خرید'}">افزودن به سبد خرید</button>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
    window.lucide?.createIcons();
};

// FIX: Make function async to await getUserData()
const renderChatTab = async (currentUser: string, userData: any) => {
    const container = document.getElementById('chat-content');
    if (!container) return;
    const coachData = userData.step1?.coachName ? await getUserData(userData.step1.coachName) : null;
    const coachName = coachData?.step1?.clientName || userData.step1?.coachName || 'بدون مربی';
    const coachAvatar = coachData?.profile?.avatar;

    const chatAccess = canUserChat(userData);
    if (!chatAccess.canChat) {
        container.innerHTML = `<div class="card p-8 text-center text-text-secondary"><i data-lucide="message-square-off" class="w-12 h-12 mx-auto mb-4"></i><p>${chatAccess.reason}</p></div>`;
        window.lucide?.createIcons();
        return;
    }

    const latestProgram = (userData.programHistory && userData.programHistory.length > 0) ? userData.programHistory[0] : null;
    let timerHtml = '';
    if (latestProgram) {
        const programSentDate = new Date(latestProgram.date);
        const now = new Date();
        const hoursPassed = (now.getTime() - programSentDate.getTime()) / (1000 * 60 * 60);
        if (hoursPassed >= 0 && hoursPassed <= 48) {
            const hoursLeft = Math.floor(48 - hoursPassed);
            const minutesLeft = Math.floor(((48 - hoursPassed) * 60) % 60);
            timerHtml = `
            <div class="p-2 text-center text-sm bg-accent/10 text-accent font-semibold flex-shrink-0">
                زمان باقی‌مانده برای گفتگو: ${hoursLeft} ساعت و ${minutesLeft} دقیقه
            </div>`;
        }
    }

    container.innerHTML = `
        <div class="card h-[calc(100vh-12rem)] flex flex-col max-w-4xl mx-auto">
            <div class="chat-header">
                ${coachAvatar ? 
                    `<img src="${coachAvatar}" alt="${coachName}" class="chat-avatar">` :
                    `<div class="chat-avatar bg-accent flex items-center justify-center font-bold text-bg-secondary text-lg">${coachName.charAt(0)}</div>`
                }
                <div>
                    <h3 class="font-bold">${coachName}</h3>
                    <p class="text-xs text-text-secondary">مربی شما</p>
                </div>
            </div>
            ${timerHtml}
            <div id="user-chat-messages-container" class="p-4 flex-grow overflow-y-auto message-container flex flex-col">
                <div class="space-y-4">
                    <!-- Messages will be injected here -->
                </div>
            </div>
            <div class="p-4 border-t border-border-primary">
                <div id="user-quick-replies" class="flex items-center gap-2 mb-2 flex-wrap"></div>
                <form id="user-chat-form" class="flex items-center gap-3">
                    <input id="user-chat-input" type="text" class="input-field flex-grow" placeholder="پیام خود را بنویسید..." autocomplete="off">
                    <button type="submit" class="primary-button !p-3"><i data-lucide="send" class="w-5 h-5"></i></button>
                </form>
            </div>
        </div>
    `;

    const renderMessages = async () => {
        const messagesContainer = document.querySelector('#user-chat-messages-container');
        const messagesInnerContainer = messagesContainer?.querySelector('div');
        if (!messagesContainer || !messagesInnerContainer) return;
        
        const currentData = await getUserData(currentUser);
        const chatHistory = (currentData.chatHistory || []);
        messagesInnerContainer.innerHTML = chatHistory.map((msg: any) => `
            <div class="flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}">
                 <div class="message-bubble ${msg.sender === 'user' ? 'message-sent' : 'message-received'}">
                    <div class="message-content">${sanitizeHTML(msg.message)}</div>
                    <div class="message-timestamp">${timeAgo(msg.timestamp)}</div>
                 </div>
            </div>
        `).join('');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };
    await renderMessages();

    const quickRepliesContainer = document.getElementById('user-quick-replies');
    if (quickRepliesContainer) {
        const replies = ['سلام مربی، وقت بخیر.', 'متشکرم.', 'انجام شد.', 'سوال داشتم.'];
        quickRepliesContainer.innerHTML = replies.map(reply => `<button class="quick-reply-btn secondary-button !text-xs !py-1 !px-3">${reply}</button>`).join('');
        quickRepliesContainer.addEventListener('click', e => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('quick-reply-btn')) {
                const input = document.getElementById('user-chat-input') as HTMLInputElement;
                if (input) {
                    input.value = target.textContent || '';
                    input.focus();
                }
            }
        });
    }

    window.lucide?.createIcons();
};

const renderNutritionTab = (currentUser: string, userData: any) => {
    const container = document.getElementById('nutrition-content');
    if (!container) return;

    const hasAccess = getUserAccessPermissions(userData).has('nutrition_plan');
    if (!hasAccess) {
        container.innerHTML = `
            <div class="card p-8 text-center text-text-secondary flex flex-col items-center justify-center">
                <i data-lucide="lock" class="w-12 h-12 mx-auto mb-4 text-accent"></i>
                <h3 class="font-bold text-xl">دسترسی به این بخش محدود است</h3>
                <p class="mt-2">برای مشاهده و دریافت برنامه‌های غذایی، لطفا پلن عضویت خود را از فروشگاه ارتقا دهید.</p>
                <button id="go-to-store-from-nutrition" class="primary-button mt-6">مشاهده پلن‌ها</button>
            </div>
        `;
        window.lucide?.createIcons();
        return;
    }

    const latestProgram = (userData.programHistory && userData.programHistory.length > 0)
        ? userData.programHistory[0]
        : null;

    const nutritionPlan = latestProgram?.nutritionPlan;

    if (!nutritionPlan || !nutritionPlan.weeklyPlan) {
        container.innerHTML = `<div class="card p-8 text-center text-text-secondary"><i data-lucide="folder-x" class="w-12 h-12 mx-auto mb-4"></i><p>هنوز برنامه غذایی برای شما ثبت نشده است. مربی شما به زودی برنامه را ارسال خواهد کرد.</p></div>`;
        window.lucide?.createIcons();
        return;
    }

    container.innerHTML = `
        <div class="card p-6 max-w-4xl mx-auto animate-fade-in-up">
            <h2 class="text-2xl font-bold mb-4">برنامه غذایی هفتگی</h2>
            <p class="text-text-secondary mb-6">این یک برنامه غذایی نمونه است که می‌توانید آن را به صورت هفتگی تکرار کنید. برای تنوع، از گزینه‌های مختلف در هر وعده استفاده نمایید.</p>
            <div class="space-y-4">
                ${(nutritionPlan.weeklyPlan || []).map((day: any) => `
                    <details class="bg-bg-tertiary rounded-lg">
                        <summary class="p-3 font-semibold cursor-pointer flex justify-between items-center">
                            <span>${day.dayName}</span>
                            <i data-lucide="chevron-down" class="details-arrow transition-transform"></i>
                        </summary>
                        <div class="p-4 border-t border-border-primary bg-bg-secondary rounded-b-lg nutrition-plan-text">
                            <ul class="space-y-4">
                            ${(day.meals || []).map((meal: any) => `
                                <li>
                                    <strong class="font-bold">${meal.mealName}:</strong>
                                    <ul class="list-disc pr-5 mt-1 text-text-secondary space-y-1">
                                        ${(meal.options || []).map((opt: string) => `<li>${sanitizeHTML(opt)}</li>`).join('')}
                                    </ul>
                                </li>
                            `).join('')}
                            </ul>
                        </div>
                    </details>
                `).join('')}
            </div>
            ${nutritionPlan.generalTips && nutritionPlan.generalTips.length > 0 ? `
            <div class="mt-6">
                <h3 class="font-bold text-lg mb-3">نکات عمومی</h3>
                <ul class="list-disc pr-5 text-text-secondary space-y-1">
                    ${nutritionPlan.generalTips.map((tip: string) => `<li>${sanitizeHTML(tip)}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
        </div>
    `;
    window.lucide?.createIcons();
};

const updateProfileMetricsDisplay = (container: HTMLElement) => {
    const metrics = calculateBodyMetrics(container);

    // BMI Gauge
    const bmiValueEl = document.getElementById('bmi-value');
    const bmiCategoryEl = document.getElementById('bmi-category');
    // FIX: Use querySelector with a generic type for type safety with SVG elements.
    const bmiArc = document.querySelector<SVGCircleElement>('#bmi-gauge-arc');

    if (bmiValueEl && bmiCategoryEl && bmiArc) {
        if (metrics && metrics.bmi) {
            const bmi = metrics.bmi;
            bmiValueEl.textContent = bmi.toFixed(1);
            let category = 'نرمال';
            let color = 'var(--admin-accent-green)';
            if (bmi < 18.5) { category = 'کمبود وزن'; color = 'var(--admin-accent-blue)'; }
            else if (bmi >= 25 && bmi < 30) { category = 'اضافه وزن'; color = 'var(--admin-accent-yellow)'; }
            else if (bmi >= 30) { category = 'چاقی'; color = 'var(--admin-accent-red)'; }
            bmiCategoryEl.textContent = category;
            bmiArc.style.stroke = color;
            
            const circumference = 2 * Math.PI * 54; // r=54
            const normalizedBmi = Math.max(0, Math.min(1, (bmi - 15) / (40 - 15)));
            const offset = circumference * (1 - normalizedBmi);
            bmiArc.style.strokeDashoffset = String(offset);
        } else {
            bmiValueEl.textContent = '--';
            bmiCategoryEl.textContent = '--';
            bmiArc.style.strokeDashoffset = String(2 * Math.PI * 54);
        }
    }

    // TDEE Gauge
    const tdeeValueEl = document.getElementById('tdee-value');
    // FIX: Use querySelector with a generic type for type safety with SVG elements.
    const tdeeArc = document.querySelector<SVGCircleElement>('#tdee-gauge-arc');

    if (tdeeValueEl && tdeeArc) {
        if (metrics && metrics.tdee) {
            tdeeValueEl.textContent = String(Math.round(metrics.tdee));
            const circumference = 2 * Math.PI * 54;
            const normalizedTdee = Math.max(0, Math.min(1, (metrics.tdee - 1000) / (4000 - 1000)));
            const offset = circumference * (1 - normalizedTdee);
            tdeeArc.style.strokeDashoffset = String(offset);
        } else {
            tdeeValueEl.textContent = '--';
            tdeeArc.style.strokeDashoffset = String(2 * Math.PI * 54);
        }
    }
};

// FIX: Make function async to await getUserData()
const renderProfileTab = async (currentUser: string, userData: any) => {
    const container = document.getElementById('profile-content');
    if (!container) return;
    const { step1, profile } = userData;
    const coachData = step1?.coachName ? await getUserData(step1.coachName) : null;
    const coachName = coachData?.step1?.clientName || step1?.coachName || 'انتخاب کنید';
    const coachNotSelected = !step1?.coachName;
    const trainingGoals = ['کاهش وزن', 'افزایش حجم', 'بهبود ترکیب بدنی', 'تناسب اندام عمومی', 'افزایش قدرت'];
    const activityLevels = [ { value: 1.2, label: 'نشسته' }, { value: 1.375, label: 'کم' }, { value: 1.55, label: 'متوسط' }, { value: 1.725, label: 'زیاد' }, { value: 1.9, label: 'خیلی زیاد' }];
    
    container.innerHTML = `
    <form id="user-profile-form">
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in-up">
            <div class="lg:col-span-3">
                <div class="card p-6 space-y-6">
                    <div>
                        <h2 class="text-xl font-bold">اطلاعات پایه</h2>
                    </div>
                    <div class="flex items-center gap-4">
                        <label for="user-profile-avatar-input" class="profile-avatar-upload block">
                            ${profile?.avatar ? 
                                `<img id="user-profile-avatar-preview" src="${profile.avatar}" alt="${step1?.clientName}" class="avatar-preview-img">` :
                                `<div id="user-profile-avatar-initials" class="avatar-initials bg-accent text-bg-secondary flex items-center justify-center text-4xl font-bold">${(step1?.clientName || '?').charAt(0)}</div>`
                            }
                            <div class="upload-overlay"><i data-lucide="camera" class="w-8 h-8"></i></div>
                        </label>
                        <input type="file" id="user-profile-avatar-input" class="hidden" accept="image/*">
                        <div class="flex-grow">
                             <div class="input-group"><input type="text" id="user-profile-name" class="input-field w-full" value="${step1?.clientName || ''}" placeholder=" "><label for="user-profile-name" class="input-label">نام و نام خانوادگی</label></div>
                             <div class="input-group mt-2"><input type="tel" id="user-profile-mobile" class="input-field w-full" value="${step1?.mobile || ''}" placeholder=" "><label class="input-label">شماره موبایل</label></div>
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">مربی</label>
                        <button type="button" id="select-coach-btn" class="input-field w-full text-right flex justify-between items-center ${coachNotSelected ? 'highlight-coach-selection' : ''}">
                            <span id="current-coach-name">${coachName}</span><i data-lucide="chevron-down" class="w-4 h-4"></i>
                        </button>
                        ${coachNotSelected ? `<div class="coach-selection-warning"><i data-lucide="alert-triangle" class="w-4 h-4"></i><span>لطفا مربی خود را انتخاب کنید.</span></div>` : ''}
                    </div>
                    <div>
                        <p class="text-sm font-semibold mb-3">جنسیت</p>
                        <div class="grid grid-cols-2 gap-4">
                            <label>
                                <input type="radio" name="gender_user" value="مرد" class="gender-card-input hidden" ${step1?.gender === 'مرد' ? 'checked data-is-checked="true"' : ''}>
                                <div class="gender-card-content card !p-4 text-center cursor-pointer transition-all duration-200 hover:border-border-secondary">
                                    <div class="icon-container w-12 h-12 rounded-full bg-bg-tertiary mx-auto flex items-center justify-center mb-2 transition-all duration-200">
                                        <i data-lucide="male-symbol" class="w-6 h-6 text-text-secondary"></i>
                                    </div>
                                    <p class="font-semibold transition-colors">مرد</p>
                                </div>
                            </label>
                            <label>
                                <input type="radio" name="gender_user" value="زن" class="gender-card-input hidden" ${step1?.gender === 'زن' ? 'checked data-is-checked="true"' : ''}>
                                <div class="gender-card-content card !p-4 text-center cursor-pointer transition-all duration-200 hover:border-border-secondary">
                                    <div class="icon-container w-12 h-12 rounded-full bg-bg-tertiary mx-auto flex items-center justify-center mb-2 transition-all duration-200">
                                        <i data-lucide="female-symbol" class="w-6 h-6 text-text-secondary"></i>
                                    </div>
                                    <p class="font-semibold transition-colors">زن</p>
                                </div>
                            </label>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div class="metric-card card !p-4 slider-container-blue">
                            <div class="text-center">
                                <label class="font-semibold text-sm text-text-secondary">سن</label>
                                <p class="my-1"><span class="text-4xl font-bold">${step1?.age || 25}</span><span class="text-text-secondary"> سال</span></p>
                            </div>
                            <input type="range" name="age" min="15" max="80" value="${step1?.age || 25}" class="range-slider age-slider w-full">
                        </div>
                        <div class="metric-card card !p-4 slider-container-green">
                            <div class="text-center">
                                <label class="font-semibold text-sm text-text-secondary">قد (cm)</label>
                                <p class="my-1"><span class="text-4xl font-bold">${step1?.height || 175}</span><span class="text-text-secondary"> cm</span></p>
                            </div>
                            <input type="range" name="height" min="140" max="220" value="${step1?.height || 175}" class="range-slider height-slider w-full">
                        </div>
                        <div class="metric-card card !p-4 slider-container-orange">
                            <div class="text-center">
                                <label class="font-semibold text-sm text-text-secondary">وزن (kg)</label>
                                <p class="my-1"><span class="text-4xl font-bold">${(step1?.weight || 75).toFixed(1)}</span><span class="text-text-secondary"> kg</span></p>
                            </div>
                            <input type="range" name="weight" min="40" max="150" step="0.5" value="${step1?.weight || 75}" class="range-slider weight-slider w-full">
                        </div>
                    </div>
                    <div><p class="text-sm font-semibold mb-2">هدف اصلی شما</p><div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        ${trainingGoals.map(goal => `<label class="option-card-label"><input type="radio" name="training_goal_user" value="${goal}" class="option-card-input" ${step1?.trainingGoal === goal ? 'checked data-is-checked="true"' : ''}><span class="option-card-content">${goal}</span></label>`).join('')}
                    </div></div>
                    <div><p class="text-sm font-semibold mb-2">روزهای تمرین در هفته</p><div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        ${[3, 4, 5, 6].map(day => `<label class="option-card-label"><input type="radio" name="training_days_user" value="${day}" class="option-card-input" ${step1?.trainingDays === day ? 'checked data-is-checked="true"' : ''}><span class="option-card-content">${day} روز</span></label>`).join('')}
                    </div></div>
                    <div><p class="text-sm font-semibold mb-2">سطح فعالیت روزانه</p><div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        ${activityLevels.map(level => `<label class="option-card-label"><input type="radio" name="activity_level_user" value="${level.value}" class="option-card-input" ${step1?.activityLevel === level.value ? 'checked data-is-checked="true"' : ''}><span class="option-card-content">${level.label}</span></label>`).join('')}
                    </div></div>
                </div>
            </div>
            <div class="lg:col-span-2">
                <div class="card p-6 h-full">
                    <h2 class="text-xl font-bold mb-6 text-center">متریک‌های کلیدی</h2>
                    <div class="flex justify-around items-start flex-wrap gap-6">
                        <div class="text-center">
                            <h3 class="font-bold mb-2">شاخص توده بدنی (BMI)</h3>
                            <div class="relative w-40 h-40 mx-auto">
                                <svg viewBox="0 0 120 120" class="w-full h-full transform -rotate-90">
                                    <circle cx="60" cy="60" r="54" fill="none" stroke="var(--bg-tertiary)" stroke-width="12" />
                                    <circle id="bmi-gauge-arc" cx="60" cy="60" r="54" fill="none" stroke="var(--admin-accent-green)" stroke-width="12" stroke-linecap="round" stroke-dasharray="339.29" stroke-dashoffset="339.29" style="transition: stroke-dashoffset 1s ease-out, stroke 0.5s ease;" />
                                </svg>
                                <div class="absolute inset-0 flex flex-col items-center justify-center">
                                    <span id="bmi-value" class="text-3xl font-extrabold">--</span>
                                    <span id="bmi-category" class="text-sm font-semibold text-text-secondary">--</span>
                                </div>
                            </div>
                            <div class="flex justify-center gap-x-3 text-xs mt-2 flex-wrap">
                                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-yellow-400"></span>اضافه وزن</span>
                                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-500"></span>نرمال</span>
                                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500"></span>چاقی</span>
                            </div>
                        </div>
                        <div class="text-center">
                            <h3 class="font-bold mb-2">کالری نگهداری (TDEE)</h3>
                            <div class="relative w-40 h-40 mx-auto">
                                <svg viewBox="0 0 120 120" class="w-full h-full transform -rotate-90">
                                    <circle cx="60" cy="60" r="54" fill="none" stroke="var(--bg-tertiary)" stroke-width="12" />
                                    <circle id="tdee-gauge-arc" cx="60" cy="60" r="54" fill="none" stroke="var(--admin-accent-blue)" stroke-width="12" stroke-linecap="round" stroke-dasharray="339.29" stroke-dashoffset="339.29" style="transition: stroke-dashoffset 1s ease-out;" />
                                </svg>
                                <div class="absolute inset-0 flex flex-col items-center justify-center">
                                    <span id="tdee-value" class="text-3xl font-extrabold">--</span>
                                    <span class="text-sm font-semibold text-text-secondary">kcal</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="mt-8">
            <button type="submit" id="profile-submit-btn" class="primary-button w-full !py-3 !text-lg flex items-center justify-center gap-2" disabled>
                <i data-lucide="save" class="w-5 h-5"></i>
                ذخیره و ارسال اطلاعات به مربی
            </button>
        </div>
    </form>
    `;
};

export async function initUserDashboard(currentUser: string, userData: any, handleLogout: () => void, handleGoToHome: () => void) {
    const mainContainer = document.getElementById('user-dashboard-container');
    if (!mainContainer) return;

    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('go-to-home-btn')?.addEventListener('click', handleGoToHome);

    const pageTitles: Record<string, { title: string, subtitle: string }> = {
        'dashboard-content': { title: 'داشبورد', subtitle: 'خلاصه فعالیت‌ها و پیشرفت شما.' },
        'program-content': { title: 'برنامه من', subtitle: 'برنامه تمرینی و مکمل‌های شما.' },
        'nutrition-content': { title: 'برنامه تغذیه', subtitle: 'برنامه غذایی اختصاصی شما.' },
        'chat-content': { title: 'گفتگو با مربی', subtitle: 'با مربی خود در ارتباط باشید.' },
        'store-content': { title: 'فروشگاه', subtitle: 'پلن‌های عضویت را مشاهده و خریداری کنید.' },
        'profile-content': { title: 'پروفایل', subtitle: 'اطلاعات فردی و فیزیکی خود را مدیریت کنید.' },
        'help-content': { title: 'راهنما', subtitle: 'پاسخ به سوالات متداول.' }
    };

    const switchTab = async (activeTab: HTMLElement) => {
        const targetId = activeTab.getAttribute('data-target');
        if (!targetId) return;

        mainContainer.querySelectorAll('.coach-nav-link').forEach(t => t.classList.remove('active-nav-link'));
        activeTab.classList.add('active-nav-link');
        mainContainer.querySelectorAll('.user-tab-content').forEach(content => {
            content.classList.toggle('hidden', content.id !== targetId);
        });

        const targetData = pageTitles[targetId];
        const titleEl = document.getElementById('user-page-title');
        const subtitleEl = document.getElementById('user-page-subtitle');
        if (titleEl && subtitleEl && targetData) {
            titleEl.textContent = targetData.title;
            subtitleEl.textContent = targetData.subtitle;
        }

        await clearNotification(currentUser, targetId);
        await updateUserNotifications(currentUser);

        const currentData = await getUserData(currentUser);
        switch (targetId) {
            case 'dashboard-content':
                renderDashboardTab(currentUser, currentData);
                break;
            case 'program-content':
                renderUnifiedProgramView(currentData);
                break;
            case 'nutrition-content':
                renderNutritionTab(currentUser, currentData);
                break;
            case 'chat-content':
                await renderChatTab(currentUser, currentData);
                break;
            case 'store-content':
                await renderStoreTab(currentUser);
                break;
            case 'profile-content':
                await renderProfileTab(currentUser, currentData);
                const profileForm = document.getElementById('user-profile-form');
                if (profileForm) {
                    const checkValidity = () => checkProfileFormValidity(currentUser);
                    profileForm.addEventListener('input', checkValidity);
                    profileForm.addEventListener('change', checkValidity);
                    await checkValidity();
                    
                    // Initialize slider tracks on load
                    profileForm.querySelectorAll<HTMLInputElement>('.range-slider').forEach(updateSliderTrack);

                    updateProfileMetricsDisplay(profileForm as HTMLElement);
                    
                    const avatarInput = document.getElementById('user-profile-avatar-input');
                    if(avatarInput) {
                        avatarInput.addEventListener('change', e => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file) return;

                            const reader = new FileReader();
                            reader.onload = () => {
                                const base64String = reader.result as string;
                                const wrapper = document.querySelector('.profile-avatar-upload');
                                if (wrapper) {
                                    const initialsDiv = document.getElementById('user-profile-avatar-initials');
                                    if (initialsDiv) initialsDiv.style.display = 'none';

                                    let previewImg = document.getElementById('user-profile-avatar-preview') as HTMLImageElement;
                                    if (!previewImg) {
                                        previewImg = document.createElement('img');
                                        previewImg.id = 'user-profile-avatar-preview';
                                        previewImg.alt = "Avatar Preview";
                                        previewImg.className = 'avatar-preview-img';
                                        wrapper.insertBefore(previewImg, wrapper.firstChild);
                                    }
                                    previewImg.src = base64String;
                                    previewImg.dataset.isNew = 'true';
                                }
                            };
                            reader.readAsDataURL(file);
                        });
                    }
                }
                break;
            case 'help-content':
                const helpContainer = document.getElementById('help-content');
                if (helpContainer) {
                    helpContainer.innerHTML = `
                        <div class="card p-6 max-w-4xl mx-auto space-y-4 animate-fade-in-up">
                            <div class="text-center mb-6">
                                <i data-lucide="help-circle" class="w-12 h-12 mx-auto text-accent"></i>
                                <h2 class="text-2xl font-bold mt-4">مرکز راهنما</h2>
                                <p class="text-text-secondary mt-2">پاسخ به سوالات متداول شما در مورد استفاده از اپلیکیشن.</p>
                            </div>
                            
                            <details class="bg-bg-tertiary rounded-lg">
                                <summary class="p-4 font-semibold cursor-pointer flex justify-between items-center">
                                    <span>داشبورد اصلی چه اطلاعاتی را نشان می‌دهد؟</span>
                                    <i data-lucide="chevron-down" class="details-arrow transition-transform"></i>
                                </summary>
                                <div class="p-4 border-t border-border-primary text-text-secondary text-sm leading-relaxed">
                                    <p>داشبورد اصلی خلاصه‌ای از وضعیت و پیشرفت شماست. در این بخش می‌توانید موارد زیر را مشاهده کنید:</p>
                                    <ul class="list-disc pr-5 mt-2 space-y-1">
                                        <li><strong>زنجیره تمرین:</strong> تعداد روزهای متوالی که تمرین خود را ثبت کرده‌اید.</li>
                                        <li><strong>کل تمرینات:</strong> مجموع تعداد تمریناتی که از ابتدا ثبت کرده‌اید.</li>
                                        <li><strong>آخرین وزن:</strong> آخرین وزنی که در پروفایل خود ثبت کرده‌اید.</li>
                                        <li><strong>پیشرفت هفتگی:</strong> نموداری که نشان می‌دهد چند درصد از تمرینات هفته را طبق برنامه انجام داده‌اید.</li>
                                        <li><strong>تمرین امروز:</strong> اگر برای امروز برنامه‌ای داشته باشید، در این بخش نمایش داده می‌شود تا به راحتی به آن دسترسی داشته و آن را ثبت کنید.</li>
                                    </ul>
                                </div>
                            </details>

                            <details class="bg-bg-tertiary rounded-lg">
                                <summary class="p-4 font-semibold cursor-pointer flex justify-between items-center">
                                    <span>چگونه برنامه تمرینی خود را مشاهده و ثبت کنم؟</span>
                                    <i data-lucide="chevron-down" class="details-arrow transition-transform"></i>
                                </summary>
                                <div class="p-4 border-t border-border-primary text-text-secondary text-sm leading-relaxed">
                                    <p><strong>برای مشاهده برنامه:</strong> به تب <strong>"برنامه من"</strong> بروید. در این بخش، برنامه کامل تمرینی و مکمل‌های شما که توسط مربی ارسال شده، قابل مشاهده است.</p>
                                    <p class="mt-2"><strong>برای ثبت تمرین:</strong> در روزی که برنامه تمرینی دارید، به <strong>داشبورد اصلی</strong> مراجعه کنید. کارت "تمرین امروز" نمایش داده می‌شود. با کلیک روی دکمه "ثبت تمرین امروز"، می‌توانید وزنه‌ها و تکرارهای انجام شده برای هر ست را وارد کرده و در انتها تمرین خود را ذخیره کنید.</p>
                                </div>
                            </details>

                            <details class="bg-bg-tertiary rounded-lg">
                                <summary class="p-4 font-semibold cursor-pointer flex justify-between items-center">
                                    <span>پروفایل من چه اهمیتی دارد؟</span>
                                    <i data-lucide="chevron-down" class="details-arrow transition-transform"></i>
                                </summary>
                                <div class="p-4 border-t border-border-primary text-text-secondary text-sm leading-relaxed">
                                    <p>اطلاعاتی که در بخش <strong>"پروفایل"</strong> وارد می‌کنید (مانند سن، قد، وزن، هدف تمرینی و سطح فعالیت) برای مربی شما بسیار حیاتی است. مربی بر اساس این اطلاعات، یک برنامه دقیق، مؤثر و ایمن برای شما طراحی می‌کند.</p>
                                    <p class="mt-2">توصیه می‌کنیم این اطلاعات را همیشه به‌روز نگه دارید، به خصوص وزن خود را به صورت منظم وارد کنید تا مربی بتواند پیشرفت شما را به درستی تحلیل کرده و در صورت نیاز برنامه را اصلاح کند.</p>
                                </div>
                            </details>

                            <details class="bg-bg-tertiary rounded-lg">
                                <summary class="p-4 font-semibold cursor-pointer flex justify-between items-center">
                                    <span>گفتگوی با مربی چگونه کار می‌کند؟</span>
                                    <i data-lucide="chevron-down" class="details-arrow transition-transform"></i>
                                </summary>
                                <div class="p-4 border-t border-border-primary text-text-secondary text-sm leading-relaxed">
                                    <p>بخش <strong>"گفتگو با مربی"</strong> یک ابزار قدرتمند برای پشتیبانی است. این ویژگی به صورت هوشمند مدیریت می‌شود:</p>
                                    <ul class="list-disc pr-5 mt-2 space-y-1">
                                        <li>پس از اینکه مربی یک برنامه جدید برای شما ارسال می‌کند، یک پنجره <strong>۴۸ ساعته</strong> برای گفتگو باز می‌شود.</li>
                                        <li>در این مدت می‌توانید تمام سوالات خود را در مورد برنامه جدید بپرسید و ابهامات را برطرف کنید.</li>
                                        <li>پس از اتمام ۴۸ ساعت، گفتگو به صورت خودکار قفل می‌شود تا تمرکز شما روی اجرای برنامه باشد.</li>
                                        <li>با خرید یا تمدید پلن و دریافت برنامه جدید، این پنجره گفتگو مجدداً برای ۴۸ ساعت فعال خواهد شد.</li>
                                    </ul>
                                </div>
                            </details>

                            <details class="bg-bg-tertiary rounded-lg">
                                <summary class="p-4 font-semibold cursor-pointer flex justify-between items-center">
                                    <span>چگونه می‌توانم یک پلن جدید خریداری یا پلن فعلی را تمدید کنم؟</span>
                                    <i data-lucide="chevron-down" class="details-arrow transition-transform"></i>
                                </summary>
                                <div class="p-4 border-t border-border-primary text-text-secondary text-sm leading-relaxed">
                                    <p>به تب <strong>"فروشگاه"</strong> بروید. در این بخش می‌توانید تمام پلن‌های عضویت موجود را با ویژگی‌ها و قیمت‌هایشان مشاهده کنید. پلن مورد نظر خود را انتخاب کرده و به سبد خرید اضافه کنید. سپس می‌توانید فرآیند پرداخت را تکمیل نمایید.</p>
                                    <p class="mt-2">اگر پروفایل شما ناقص باشد (مثلاً مربی خود را انتخاب نکرده باشید)، امکان خرید پلن وجود نخواهد داشت. ابتدا پروفایل خود را کامل کنید.</p>
                                </div>
                            </details>

                            <details class="bg-bg-tertiary rounded-lg">
                                <summary class="p-4 font-semibold cursor-pointer flex justify-between items-center">
                                    <span>برنامه غذایی را از کجا ببینم؟</span>
                                    <i data-lucide="chevron-down" class="details-arrow transition-transform"></i>
                                </summary>
                                <div class="p-4 border-t border-border-primary text-text-secondary text-sm leading-relaxed">
                                    <p>اگر پلن خریداری شده شما شامل "برنامه غذایی" باشد، می‌توانید آن را در تب <strong>"برنامه تغذیه"</strong> مشاهده کنید. این بخش به صورت جداگانه طراحی شده تا دسترسی به رژیم غذایی شما آسان باشد.</p>
                                    <p class="mt-2">در صورتی که این تب برای شما قفل است، به این معنی است که پلن فعلی شما شامل برنامه غذایی نمی‌شود. برای دسترسی به این ویژگی می‌توانید پلن خود را از فروشگاه ارتقا دهید.</p>
                                </div>
                            </details>

                            <div class="pt-6 mt-6 border-t border-border-primary text-center">
                                <h3 class="font-semibold">پاسخ خود را پیدا نکردید؟</h3>
                                <p class="text-text-secondary text-sm mt-2">مشکلی نیست. تیم پشتیبانی ما آماده کمک به شماست. با ما از طریق ایمیل زیر در ارتباط باشید:</p>
                                <a href="mailto:support@fitgympro.com" class="font-bold text-accent mt-3 inline-block">support@fitgympro.com</a>
                            </div>
                        </div>
                    `;
                    window.lucide?.createIcons();
                }
                break;
        }
    };
    
    const defaultTab = mainContainer.querySelector<HTMLElement>('.coach-nav-link');
    if (defaultTab) {
        const redirectToTab = sessionStorage.getItem('fitgympro_redirect_to_tab');
        if (redirectToTab) {
            const tabToSwitch = mainContainer.querySelector<HTMLElement>(`.coach-nav-link[data-target="${redirectToTab}"]`);
            await switchTab(tabToSwitch || defaultTab);
            sessionStorage.removeItem('fitgympro_redirect_to_tab');
            
            if (sessionStorage.getItem('fitgympro_open_cart') === 'true') {
                setTimeout(async () => {
                    await renderCartModalContentAndBadge(currentUser);
                    openModal(document.getElementById('cart-modal'));
                    sessionStorage.removeItem('fitgympro_open_cart');
                }, 100);
            }
        } else {
            await switchTab(defaultTab);
        }
    }

    // Initial cart render
    await renderCartModalContentAndBadge(currentUser);

    document.getElementById('close-user-modal-btn')?.addEventListener('click', () => {
        closeModal(document.getElementById('user-dashboard-modal'));
    });
    document.getElementById('close-cart-modal-btn')?.addEventListener('click', () => {
        closeModal(document.getElementById('cart-modal'));
    });
     document.getElementById('header-cart-btn')?.addEventListener('click', async () => {
        await renderCartModalContentAndBadge(currentUser);
        openModal(document.getElementById('cart-modal'));
    });

    const openCoachSelectionModal = async (coaches: any[]) => {
        const modal = document.getElementById('user-dashboard-modal');
        const titleEl = document.getElementById('user-modal-title');
        const bodyEl = document.getElementById('user-modal-body');
        if (!modal || !titleEl || !bodyEl) return;
    
        titleEl.textContent = 'انتخاب مربی';

        const coachDataPromises = coaches.map(async (coach) => {
            const coachData = await getUserData(coach.username);
            const name = coachData.step1?.clientName || coach.username;
            const specialization = coachData.profile?.specialization || 'مربی بدنسازی';
            const avatar = coachData.profile?.avatar;
            return `
                <button class="coach-selection-card text-center p-4 border rounded-lg hover:bg-bg-tertiary hover:border-accent transition-colors" data-coach-username="${coach.username}" data-coach-name="${name}">
                    ${avatar ? `<img src="${avatar}" class="w-20 h-20 rounded-full mx-auto mb-3 object-cover">` : `<div class="w-20 h-20 rounded-full mx-auto mb-3 bg-bg-tertiary flex items-center justify-center font-bold text-2xl">${name.charAt(0)}</div>`}
                    <p class="font-bold">${name}</p>
                    <p class="text-xs text-text-secondary">${specialization}</p>
                </button>
            `;
        });
        
        const coachCardsHtml = await Promise.all(coachDataPromises);

        bodyEl.innerHTML = `
            <p class="text-text-secondary mb-4">لطفا مربی مورد نظر خود را برای دریافت برنامه انتخاب کنید.</p>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${coachCardsHtml.join('')}
            </div>
        `;
        openModal(modal);
    }
    
    mainContainer.addEventListener('click', async e => {
        if (!(e.target instanceof HTMLElement)) return;
        const target = e.target;
        
        const navLink = target.closest<HTMLElement>('.coach-nav-link');
        if (navLink) {
            if (!navLink.classList.contains('locked-feature')) {
                await switchTab(navLink);
            } else {
                showToast('برای دسترسی به این بخش، لطفا یک پلن مناسب از فروشگاه تهیه کنید.', 'warning');
            }
            return;
        }

        const actionBtn = target.closest<HTMLButtonElement>('button[data-action]');
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            const dayIndex = parseInt(actionBtn.dataset.dayIndex || '-1', 10);
            
            if (action === 'log-workout' && dayIndex !== -1) {
                const todayData = getTodayWorkoutData(await getUserData(currentUser));
                if (todayData && todayData.dayIndex === dayIndex) {
                    openWorkoutLogModal(todayData.day, dayIndex, currentUser);
                }
            } else if (action === 'go-to-store') {
                const storeTab = document.querySelector<HTMLElement>('.coach-nav-link[data-target="store-content"]');
                if (storeTab) await switchTab(storeTab);
            }
        }
        
        const goToProfileBtn = target.closest('#go-to-profile-from-store');
        if (goToProfileBtn) {
            const profileTab = document.querySelector<HTMLElement>('.coach-nav-link[data-target="profile-content"]');
            if (profileTab) await switchTab(profileTab);
        }

        const savePdfBtn = target.closest('#save-program-pdf-btn');
        if (savePdfBtn) {
            exportElement('#unified-program-view', 'pdf', 'FitGymPro-Program.pdf', savePdfBtn as HTMLButtonElement);
        }
        const saveImgBtn = target.closest('#save-program-img-btn');
        if (saveImgBtn) {
            exportElement('#unified-program-view', 'png', 'FitGymPro-Program.png', saveImgBtn as HTMLButtonElement);
        }

        const addToCartBtn = target.closest('.add-to-cart-btn');
        if (addToCartBtn) {
            const planId = (addToCartBtn as HTMLElement).dataset.planId;
            const plans = await getStorePlans();
            const planToAdd = plans.find((p:any) => p.planId === planId);
            if (planToAdd) {
                const cart = await getCart(currentUser);
                if (!cart.items.some((item: any) => item.planId === planId)) {
                    cart.items.push(planToAdd);
                    await saveCart(currentUser, cart);
                    showToast(`${planToAdd.planName} به سبد خرید اضافه شد.`, 'success');
                    await renderCartModalContentAndBadge(currentUser);
                } else {
                    showToast('این پلن قبلا به سبد خرید اضافه شده است.', 'warning');
                }
            }
        }

        const removeFromCartBtn = target.closest('.remove-from-cart-btn');
        if (removeFromCartBtn) {
            const planId = (removeFromCartBtn as HTMLElement).dataset.planId;
            let cart = await getCart(currentUser);
            cart.items = cart.items.filter((item: any) => item.planId !== planId);
            await saveCart(currentUser, cart);
            await renderCartModalContentAndBadge(currentUser);
        }

        const applyDiscountBtn = target.closest('#apply-discount-btn-modal');
        if (applyDiscountBtn) {
            const input = document.getElementById('discount-code-input-modal') as HTMLInputElement;
            const code = input.value.trim().toUpperCase();
            const discounts = await getDiscounts();
            if (discounts[code]) {
                const cart = await getCart(currentUser);
                cart.discountCode = code;
                await saveCart(currentUser, cart);
                showToast(`کد تخفیف ${code} اعمال شد.`, 'success');
                await renderCartModalContentAndBadge(currentUser);
            } else {
                showToast('کد تخفیف نامعتبر است.', 'error');
            }
        }

        const checkoutBtn = target.closest('#checkout-btn-modal');
        if (checkoutBtn) {
            const cart = await getCart(currentUser);
            if(cart.items.length === 0) return;

            const freshUserData = await getUserData(currentUser);
            if (!freshUserData.subscriptions) freshUserData.subscriptions = [];
            
            const newSubscriptions = cart.items.map((item: any) => ({
                ...item,
                purchaseDate: new Date().toISOString(),
                fulfilled: false,
            }));
            
            freshUserData.subscriptions.push(...newSubscriptions);
            await saveUserData(currentUser, freshUserData);
            
            await saveCart(currentUser, { items: [], discountCode: null });
            
            // Re-render the entire dashboard to reflect new permissions
            const appRoot = document.getElementById('app-root');
            if (appRoot) {
                appRoot.innerHTML = await renderUserDashboard(currentUser, freshUserData);
                await initUserDashboard(currentUser, freshUserData, handleLogout, handleGoToHome);
            }

            showToast('خرید شما با موفقیت انجام شد! مربی به زودی برنامه شما را ارسال خواهد کرد.', 'success');
            
            const coachUsername = freshUserData.step1?.coachName;
            if (coachUsername) {
                await setNotification(coachUsername, 'students-content', '🔔');
            }

            closeModal(document.getElementById('cart-modal'));
            return; // Important to stop execution here after re-render
        }

        const goToStoreBtn = target.closest('#go-to-store-from-nutrition');
        if (goToStoreBtn) {
            const storeTab = document.querySelector<HTMLElement>('.coach-nav-link[data-target="store-content"]');
            if (storeTab) await switchTab(storeTab);
        }

        const selectCoachBtn = target.closest('#select-coach-btn');
        if (selectCoachBtn) {
            const coaches = (await getUsers()).filter((u:any) => u.role === 'coach' && u.coachStatus === 'verified');
            await openCoachSelectionModal(coaches);
        }

        const coachCard = target.closest('.coach-selection-card');
        if (coachCard) {
            selectedCoachInModal = (coachCard as HTMLElement).dataset.coachUsername || null;
            const coachName = (coachCard as HTMLElement).dataset.coachName || 'انتخاب کنید';

            const btn = document.getElementById('select-coach-btn');
            const nameEl = document.getElementById('current-coach-name');
            if (btn && nameEl) {
                nameEl.textContent = coachName;
                btn.classList.remove('highlight-coach-selection');
                const warning = btn.parentElement?.querySelector('.validation-message');
                if (warning) warning.innerHTML = '';
            }
            closeModal(document.getElementById('user-dashboard-modal'));
            await checkProfileFormValidity(currentUser);
        }
        
        const progressTabs = mainContainer.querySelector('#progress-chart-tabs');
        if (progressTabs) {
            const tabButton = target.closest<HTMLElement>('.progress-tab-btn');
            if (tabButton && !tabButton.classList.contains('active-tab')) {
                progressTabs.querySelectorAll('.progress-tab-btn').forEach(btn => btn.classList.remove('active-tab'));
                tabButton.classList.add('active-tab');
                const chartType = tabButton.dataset.chart;
                const currentData = await getUserData(currentUser);
                if (chartType) {
                    renderProgressChart(chartType, currentData);
                }
            }
        }
    });

    mainContainer.addEventListener('input', e => {
        const target = e.target as HTMLInputElement;
        const profileForm = target.closest('#user-profile-form');
        if (target.matches('.range-slider')) {
            const card = target.closest('.metric-card');
            if (card) {
                const valueSpan = card.querySelector('.text-4xl.font-bold');
                if (valueSpan) {
                     valueSpan.textContent = target.step === '0.5' ? parseFloat(target.value).toFixed(1) : target.value;
                }
            }
            updateSliderTrack(target);
            if (profileForm) {
                updateProfileMetricsDisplay(profileForm as HTMLElement);
            }
        }
        if (profileForm && (target.matches('.neck-input, .waist-input, .hip-input'))) {
            updateProfileMetricsDisplay(profileForm as HTMLElement);
        }
    });

    mainContainer.addEventListener('change', e => {
        const target = e.target as HTMLInputElement;
        const profileForm = target.closest('#user-profile-form');
        if (target.matches('input[type="radio"]') && profileForm) {
            updateProfileMetricsDisplay(profileForm as HTMLElement);
        }
        if (target.name === 'specialized_sport_user' && profileForm) {
            const specificSportContainer = profileForm.querySelector('#specific-sport-container');
            const showFor = ['martial_arts', 'pro_athlete', 'other'];
            if (showFor.includes(target.value)) {
                specificSportContainer?.classList.remove('hidden');
            } else {
                specificSportContainer?.classList.add('hidden');
                const input = specificSportContainer?.querySelector('input');
                if(input) input.value = '';
            }
        }
    });

    mainContainer.addEventListener('submit', async e => {
        e.preventDefault();
        const target = e.target as HTMLElement;

        if (target.id === 'user-chat-form') {
            const input = document.getElementById('user-chat-input') as HTMLInputElement;
            const message = input.value.trim();
            if (message) {
                const freshUserData = await getUserData(currentUser);
                if (!freshUserData.chatHistory) freshUserData.chatHistory = [];
                freshUserData.chatHistory.push({
                    sender: 'user',
                    message,
                    timestamp: new Date().toISOString()
                });
                await saveUserData(currentUser, freshUserData);
                input.value = '';
                await renderChatTab(currentUser, freshUserData);
                
                const coachUsername = freshUserData.step1?.coachName;
                if(coachUsername) {
                    await setNotification(coachUsername, 'chat-content', '💬');
                }
            }
        }
        
        if (target.id === 'workout-log-form') {
            const dayIndex = parseInt(target.dataset.dayIndex || '-1', 10);
            if (dayIndex === -1) return;

            const exercises: any[] = [];
            target.querySelectorAll('.exercise-log-item').forEach(exItem => {
                const name = (exItem.querySelector('h4') as HTMLElement).textContent || '';
                const sets: any[] = [];
                exItem.querySelectorAll('.set-log-row').forEach(setRow => {
                    const weight = (setRow.querySelector('.weight-log-input') as HTMLInputElement).value;
                    const reps = (setRow.querySelector('.reps-log-input') as HTMLInputElement).value;
                    if(weight && reps) {
                        sets.push({ weight: parseFloat(weight), reps: parseInt(reps, 10) });
                    }
                });
                if (sets.length > 0) {
                    exercises.push({ name, sets });
                }
            });

            const freshUserData = await getUserData(currentUser);
            if (!freshUserData.workoutHistory) freshUserData.workoutHistory = [];
            freshUserData.workoutHistory.push({
                date: new Date().toISOString(),
                dayIndex: dayIndex,
                exercises: exercises
            });
            await saveUserData(currentUser, freshUserData);
            await addActivityLog(`${currentUser} logged a workout.`);
            showToast('تمرین با موفقیت ثبت شد!', 'success');
            closeModal(document.getElementById('user-dashboard-modal'));
            renderDashboardTab(currentUser, freshUserData);
        }

        if (target.id === 'user-profile-form') {
            const form = target as HTMLFormElement;
            const oldUserData = await getUserData(currentUser);
            const wasProfileIncomplete = !oldUserData.step1?.coachName;

            const dataToUpdate: any = {
                step1: { ...oldUserData.step1 },
                profile: { ...oldUserData.profile }
            };

            const getVal = (selector: string) => (form.querySelector(selector) as HTMLInputElement)?.value.trim();
            const getFloat = (selector: string) => parseFloat((form.querySelector(selector) as HTMLInputElement)?.value);
            const getInt = (selector: string) => parseInt((form.querySelector(selector) as HTMLInputElement)?.value, 10);
            const getRadio = (name: string) => (form.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement)?.value;

            const clientName = getVal('#user-profile-name');
            if (clientName) dataToUpdate.step1.clientName = clientName;

            const mobile = getVal('#user-profile-mobile');
            if (mobile) dataToUpdate.step1.mobile = mobile;
            
            const avatarPreview = document.getElementById('user-profile-avatar-preview') as HTMLImageElement;
            if (avatarPreview && avatarPreview.dataset.isNew === 'true' && avatarPreview.src.startsWith('data:image/')) {
                dataToUpdate.profile.avatar = avatarPreview.src;
            }

            if (selectedCoachInModal) dataToUpdate.step1.coachName = selectedCoachInModal;

            const gender = getRadio("gender_user");
            if (gender) dataToUpdate.step1.gender = gender;

            const age = getInt('input[name="age"]');
            if (!isNaN(age)) dataToUpdate.step1.age = age;
            
            const height = getInt('input[name="height"]');
            if (!isNaN(height)) dataToUpdate.step1.height = height;
            
            const weight = getFloat('input[name="weight"]');
            if (!isNaN(weight)) {
                dataToUpdate.step1.weight = weight;
                if (!oldUserData.weightHistory) oldUserData.weightHistory = [];
                const lastWeightEntry = oldUserData.weightHistory[oldUserData.weightHistory.length - 1];
                if (!lastWeightEntry || lastWeightEntry.weight !== weight) {
                     oldUserData.weightHistory.push({ date: new Date().toISOString(), weight });
                }
            }
            
            const trainingGoal = getRadio("training_goal_user");
            if (trainingGoal) dataToUpdate.step1.trainingGoal = trainingGoal;
            
            const trainingDays = getRadio("training_days_user");
            if (trainingDays) dataToUpdate.step1.trainingDays = parseInt(trainingDays, 10);
            
            const activityLevel = getRadio("activity_level_user");
            if (activityLevel) dataToUpdate.step1.activityLevel = parseFloat(activityLevel);
            
            const metrics = performMetricCalculations(dataToUpdate.step1);
            if (metrics) {
                dataToUpdate.step1.tdee = metrics.tdee;
            }
            dataToUpdate.lastProfileUpdate = new Date().toISOString();

            await saveUserData(currentUser, { ...oldUserData, ...dataToUpdate });
            const newUserData = await getUserData(currentUser);
            
            await addActivityLog(`${currentUser} updated their profile.`);

            if (wasProfileIncomplete && newUserData.step1?.coachName) {
                showToast('پروفایل شما کامل شد! در حال انتقال به فروشگاه...', 'success');
                setTimeout(() => {
                    const storeTab = mainContainer.querySelector<HTMLElement>('.coach-nav-link[data-target="store-content"]');
                    if (storeTab) switchTab(storeTab);
                }, 1500);
            } else {
                showToast('اطلاعات با موفقیت برای مربی ارسال شد.', 'success');
            }
            
            const name = dataToUpdate.step1.clientName || currentUser;
            const coachData = await getUserData(dataToUpdate.step1.coachName);
            const coachName = coachData?.step1?.clientName || dataToUpdate.step1.coachName || 'بدون مربی';
            
            const headerProfileInfo = mainContainer.querySelector('.flex.items-center.gap-3.bg-bg-secondary');
            if(headerProfileInfo) {
                const avatarContainer = headerProfileInfo.children[0];
                const textContainer = headerProfileInfo.children[1];
                if (dataToUpdate.profile.avatar) {
                    avatarContainer.innerHTML = `<img src="${dataToUpdate.profile.avatar}" alt="${name}" class="w-10 h-10 rounded-full object-cover">`;
                } else {
                    const initials = name.substring(0, 1).toUpperCase();
                    avatarContainer.innerHTML = `<div class="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-lg text-bg-secondary" style="background-color: var(--accent);">${initials}</div>`;
                }
                (textContainer.querySelector('.font-bold.text-sm') as HTMLElement).textContent = name;
                (textContainer.querySelector('.text-xs.text-text-secondary') as HTMLElement).textContent = `مربی: ${coachName}`;
            }
            
            await renderProfileTab(currentUser, newUserData);
            const newProfileForm = document.getElementById('user-profile-form');
            if (newProfileForm) {
                updateProfileMetricsDisplay(newProfileForm as HTMLElement);
                await checkProfileFormValidity(currentUser);
            }
        }
    });
}