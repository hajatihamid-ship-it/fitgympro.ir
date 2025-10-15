import { getTemplates, saveTemplate, deleteTemplate, getUsers, getUserData, saveUserData, getNotifications, setNotification, clearNotification, getExercisesDB, getSupplementsDB, getMagazineArticles, saveMagazineArticles } from '../services/storage';
import { showToast, updateSliderTrack, openModal, closeModal, exportElement, sanitizeHTML, hexToRgba } from '../utils/dom';
import { getLatestPurchase, timeAgo, getLastActivity, getLastActivityDate } from '../utils/helpers';
import { generateCoachingInsight } from '../services/gemini';
import { getWeightChange, getWorkoutsThisWeek } from '../utils/calculations';
import { renderProgramBuilder, initProgramBuilder } from './programBuilder';

let studentModalChartInstance: any = null;
let programBuilderControls: any = null;

export function renderCoachDashboard(currentUser: string, userData: any, coachTier: string) {
    const name = userData.step1?.clientName || currentUser;
    
    let navItems = [
        { target: 'dashboard-content', icon: 'layout-dashboard', label: 'داشبورد' },
        { target: 'students-content', icon: 'users', label: 'شاگردان' },
        { target: 'chat-content', icon: 'message-square', label: 'گفتگو' },
        { target: 'program-builder-content', icon: 'file-plus-2', label: 'برنامه‌ساز' },
        { target: 'templates-content', icon: 'save', label: 'الگوها' },
    ];

    if (coachTier === 'pro' || coachTier === 'head_coach') {
        navItems.push({ target: 'magazine-content', icon: 'book-open-text', label: 'مجله' });
    }
    if (coachTier === 'head_coach') {
        navItems.push({ target: 'team-content', icon: 'users-2', label: 'تیم من' });
    }
    
    navItems.push({ target: 'profile-content', icon: 'user-cog', label: 'پروفایل' });
    
    return `
    <div id="coach-dashboard-container" class="lg:flex h-screen bg-bg-primary transition-opacity duration-500 opacity-0">
        <aside class="fixed inset-y-0 right-0 z-40 w-64 bg-bg-secondary p-4 flex flex-col flex-shrink-0 border-l border-border-primary transform translate-x-full transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0">
            <div class="flex items-center gap-3 p-2 mb-6">
                <i data-lucide="dumbbell" class="w-8 h-8 text-accent"></i>
                <h1 class="text-xl font-bold">FitGym Pro</h1>
            </div>
            <nav class="space-y-2 flex-grow">
                ${navItems.map(item => `
                    <button class="coach-nav-link w-full flex items-center gap-3 py-3 rounded-lg text-md" data-target="${item.target}">
                        <i data-lucide="${item.icon}" class="w-5 h-5"></i>
                        <span>${item.label}</span>
                        <span class="notification-badge mr-auto"></span>
                    </button>
                `).join('')}
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
            <div id="impersonation-banner-placeholder"></div>
            <header class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <div class="flex items-center gap-2">
                    <button id="sidebar-toggle" class="lg:hidden p-2 -mr-2 text-text-secondary hover:text-text-primary">
                        <i data-lucide="menu" class="w-6 h-6"></i>
                    </button>
                    <div>
                        <h1 id="coach-page-title" class="text-3xl font-bold">داشبورد</h1>
                        <p id="coach-page-subtitle" class="text-text-secondary">خلاصه فعالیت‌ها و آمار شما.</p>
                    </div>
                </div>
                <div class="flex items-center gap-3 bg-bg-secondary p-2 rounded-lg">
                    <div class="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-lg text-bg-secondary" style="background-color: var(--accent);">
                        ${name.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                        <p class="font-bold text-sm">${name}</p>
                        <p class="text-xs text-text-secondary">مربی</p>
                    </div>
                </div>
            </header>

            <div id="dashboard-content" class="coach-tab-content hidden"></div>
            <div id="students-content" class="coach-tab-content hidden"></div>
            <div id="chat-content" class="coach-tab-content hidden"></div>
            <div id="program-builder-content" class="coach-tab-content hidden">${renderProgramBuilder()}</div>
            <div id="templates-content" class="coach-tab-content hidden"></div>
            <div id="magazine-content" class="coach-tab-content hidden"></div>
            <div id="team-content" class="coach-tab-content hidden"></div>
            <div id="profile-content" class="coach-tab-content hidden"></div>
            
            <!-- Modals for Coach Dashboard -->
            <div id="selection-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
                <div class="card w-full max-w-2xl transform scale-95 transition-transform duration-300 relative max-h-[90vh] flex flex-col">
                    <div class="selection-modal-header p-4 border-b border-border-primary flex-shrink-0">
                         <div class="flex justify-between items-center mb-4">
                            <h2 class="selection-modal-title font-bold text-xl"></h2>
                            <button class="close-modal-btn secondary-button !p-2 rounded-full"><i data-lucide="x"></i></button>
                        </div>
                        <div class="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div class="relative flex-grow">
                                <i data-lucide="search" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary"></i>
                                <input type="search" class="selection-modal-search input-field w-full !pr-10" placeholder="جستجو...">
                            </div>
                            <div id="student-filter-chips" class="flex items-center gap-2">
                                <span class="filter-chip active" data-filter="all">همه</span>
                                <span class="filter-chip" data-filter="needs_plan">در انتظار</span>
                                <span class="filter-chip" data-filter="inactive">غیرفعال</span>
                            </div>
                             <select id="student-sort-select" class="input-field !text-sm">
                                <option value="name">مرتب‌سازی: نام</option>
                                <option value="activity">مرتب‌سازی: آخرین فعالیت</option>
                                <option value="join_date">مرتب‌سازی: تاریخ عضویت</option>
                            </select>
                        </div>
                    </div>
                    <div class="selection-modal-options p-4 pt-2 overflow-y-auto flex-grow">
                        <!-- Options will be injected here -->
                    </div>
                </div>
            </div>
            
            <div id="student-profile-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
                <div class="card w-full max-w-5xl transform scale-95 transition-transform duration-300 relative max-h-[90vh] flex flex-col">
                    <div class="flex justify-between items-center p-4 border-b border-border-primary flex-shrink-0">
                        <h2 id="student-modal-name" class="font-bold text-xl"></h2>
                        <button class="close-modal-btn secondary-button !p-2 rounded-full"><i data-lucide="x"></i></button>
                    </div>
                    <div class="flex-grow flex flex-col md:flex-row overflow-hidden">
                        <div class="w-full md:w-1/3 border-l border-border-primary flex-shrink-0 bg-bg-tertiary overflow-y-auto">
                            <!-- Student Info Sidebar -->
                        </div>
                        <div class="w-full md:w-2/3 flex flex-col">
                            <div class="flex-shrink-0 p-2 bg-bg-tertiary border-b border-border-primary">
                                <div class="bg-bg-secondary p-1 rounded-lg flex items-center gap-1">
                                     <button class="student-modal-tab admin-tab-button flex-1 active-tab" data-target="student-program-content">برنامه</button>
                                     <button class="student-modal-tab admin-tab-button flex-1" data-target="student-progress-content">روند پیشرفت</button>
                                     <button class="student-modal-tab admin-tab-button flex-1" data-target="student-chat-content">گفتگو</button>
                                </div>
                            </div>
                            <div class="flex-grow overflow-y-auto p-4">
                                <div id="student-program-content" class="student-modal-content">
                                    <div id="student-program-content-wrapper"></div>
                                </div>
                                <div id="student-progress-content" class="student-modal-content hidden"></div>
                                <div id="student-chat-content" class="student-modal-content hidden h-full">
                                   <div class="h-full flex flex-col">
                                         <div id="coach-chat-messages-container" class="p-2 flex-grow overflow-y-auto message-container flex flex-col">
                                            <div class="space-y-4"></div>
                                        </div>
                                        <div class="p-2 border-t border-border-primary">
                                            <div id="coach-quick-replies" class="flex items-center gap-2 mb-2 flex-wrap"></div>
                                            <form id="coach-chat-form" class="flex items-center gap-3">
                                                <input id="coach-chat-input" type="text" class="input-field flex-grow" placeholder="پیام خود را بنویسید..." autocomplete="off">
                                                <button type="submit" class="primary-button !p-3"><i data-lucide="send" class="w-5 h-5"></i></button>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
             <div id="local-client-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
                <form id="local-client-form" class="card w-full max-w-lg transform scale-95 transition-transform duration-300 relative">
                     <div class="flex justify-between items-center p-4 border-b border-border-primary">
                        <h2 id="local-client-modal-title" class="font-bold text-xl">افزودن شاگرد حضوری</h2>
                        <button type="button" class="close-modal-btn secondary-button !p-2 rounded-full"><i data-lucide="x"></i></button>
                    </div>
                    <div class="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                        <div>
                            <h3 class="font-bold text-md mb-3 border-b border-border-primary pb-2 text-accent">اطلاعات پایه</h3>
                            <div class="space-y-4 pt-2">
                                <div class="input-group"><input type="text" name="clientName" class="input-field w-full" placeholder=" " required><label class="input-label">نام و نام خانوادگی *</label></div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="input-group"><input type="number" name="age" class="input-field w-full" placeholder=" "><label class="input-label">سن</label></div>
                                    <div class="input-group"><input type="number" name="height" class="input-field w-full" placeholder=" "><label class="input-label">قد (cm)</label></div>
                                </div>
                                <div class="input-group"><input type="number" step="0.5" name="weight" class="input-field w-full" placeholder=" "><label class="input-label">وزن (kg)</label></div>
                                <div>
                                    <p class="text-sm font-semibold mb-2">جنسیت</p>
                                    <div class="grid grid-cols-2 gap-2">
                                        <label class="option-card-label"><input type="radio" name="gender" value="مرد" class="option-card-input" checked><span class="option-card-content">مرد</span></label>
                                        <label class="option-card-label"><input type="radio" name="gender" value="زن" class="option-card-input"><span class="option-card-content">زن</span></label>
                                    </div>
                                </div>
                                 <div class="input-group"><input type="text" name="contact" class="input-field w-full" placeholder=" "><label class="input-label">اطلاعات تماس (اختیاری)</label></div>
                            </div>
                        </div>
        
                         <div>
                            <h3 class="font-bold text-md mb-3 border-b border-border-primary pb-2 text-accent">جزئیات تمرینی</h3>
                            <div class="space-y-4 pt-2">
                                <div class="input-group"><input type="text" name="trainingGoal" class="input-field w-full" placeholder="مثلا: کاهش وزن, افزایش حجم"><label class="input-label">هدف تمرینی</label></div>
                                <div class="input-group"><input type="number" name="trainingDays" class="input-field w-full" placeholder=" "><label class="input-label">روزهای تمرین در هفته</label></div>
                                <div>
                                    <p class="text-sm font-semibold mb-2">سطح فعالیت روزانه</p>
                                    <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        <label class="option-card-label"><input type="radio" name="activityLevel" value="1.2" class="option-card-input"><span class="option-card-content">نشسته</span></label>
                                        <label class="option-card-label"><input type="radio" name="activityLevel" value="1.375" class="option-card-input"><span class="option-card-content">کم</span></label>
                                        <label class="option-card-label"><input type="radio" name="activityLevel" value="1.55" class="option-card-input" checked><span class="option-card-content">متوسط</span></label>
                                        <label class="option-card-label"><input type="radio" name="activityLevel" value="1.725" class="option-card-input"><span class="option-card-content">زیاد</span></label>
                                        <label class="option-card-label"><input type="radio" name="activityLevel" value="1.9" class="option-card-input"><span class="option-card-content">خیلی زیاد</span></label>
                                    </div>
                                </div>
                                <div>
                                    <p class="text-sm font-semibold mb-2">سطح تجربه</p>
                                    <div class="grid grid-cols-3 gap-2">
                                        <label class="option-card-label"><input type="radio" name="experienceLevel" value="مبتدی" class="option-card-input" checked><span class="option-card-content">مبتدی</span></label>
                                        <label class="option-card-label"><input type="radio" name="experienceLevel" value="متوسط" class="option-card-input"><span class="option-card-content">متوسط</span></label>
                                        <label class="option-card-label"><input type="radio" name="experienceLevel" value="پیشرفته" class="option-card-input"><span class="option-card-content">پیشرفته</span></label>
                                    </div>
                                </div>
                                <div class="input-group"><textarea name="limitations" class="input-field w-full min-h-[80px]" placeholder=" "></textarea><label class="input-label">آسیب دیدگی یا محدودیت‌ها</label></div>
                            </div>
                        </div>
        
                        <div>
                            <h3 class="font-bold text-md mb-3 border-b border-border-primary pb-2 text-accent">سایر اطلاعات</h3>
                            <div class="space-y-4 pt-2">
                                <div class="input-group"><textarea name="coachNotes" class="input-field w-full min-h-[80px]" placeholder=" "></textarea><label class="input-label">یادداشت‌های مربی (محرمانه)</label></div>
                            </div>
                        </div>
                    </div>
                    <div class="p-4 border-t border-border-primary"><button type="submit" class="primary-button w-full">ذخیره شاگرد</button></div>
                </form>
            </div>
            <div id="replacement-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
                <div class="card w-full max-w-lg transform scale-95 transition-transform duration-300 relative">
                    <div class="flex justify-between items-center p-4 border-b border-border-primary">
                        <h2 id="replacement-modal-title" class="font-bold text-xl">جایگزینی برای: <span class="text-accent"></span></h2>
                        <button class="close-modal-btn secondary-button !p-2 rounded-full"><i data-lucide="x"></i></button>
                    </div>
                    <div id="replacement-modal-body" class="p-6 min-h-[150px]">
                        <!-- Loading or suggestions here -->
                    </div>
                    <div class="p-4 border-t border-border-primary flex justify-end">
                        <button id="just-delete-btn" class="secondary-button !text-red-accent">فقط حذف کن</button>
                    </div>
                </div>
            </div>
            <div id="magazine-article-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
                <form id="magazine-article-form" class="card w-full max-w-2xl transform scale-95 transition-transform duration-300 relative max-h-[90vh] flex flex-col">
                     <div class="flex justify-between items-center p-4 border-b border-border-primary flex-shrink-0">
                        <h2 id="magazine-article-modal-title" class="font-bold text-xl">افزودن مقاله جدید</h2>
                        <button type="button" class="close-modal-btn secondary-button !p-2 rounded-full"><i data-lucide="x"></i></button>
                    </div>
                    <div class="p-6 space-y-4 overflow-y-auto">
                        <div class="input-group"><input type="text" name="title" class="input-field w-full" placeholder=" " required><label class="input-label">عنوان مقاله</label></div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div class="input-group"><input type="text" name="category" class="input-field w-full" placeholder=" " required><label class="input-label">دسته بندی</label></div>
                            <div class="input-group"><input type="url" name="imageUrl" class="input-field w-full" placeholder=" "><label class="input-label">URL تصویر</label></div>
                        </div>
                        <div class="input-group"><textarea name="content" class="input-field w-full min-h-[200px]" placeholder=" " required></textarea><label class="input-label">محتوای مقاله</label></div>
                    </div>
                    <div class="p-4 border-t border-border-primary flex-shrink-0"><button type="submit" class="primary-button w-full">ذخیره مقاله</button></div>
                </form>
            </div>
        </main>
    </div>
    `;
}

const getCoachAllStudents = async (coachUsername: string) => {
    // 1. Get registered students
    const allUsers = await getUsers();
    const registeredStudentPromises = allUsers
        .filter((u: any) => u.role === 'user')
        .map(async (u: any) => {
            const studentData = await getUserData(u.username);
            if (studentData.step1?.coachName === coachUsername) {
                return { ...u, isLocal: false, id: u.username };
            }
            return null;
        });
    
    const registeredStudents = (await Promise.all(registeredStudentPromises)).filter(s => s !== null);

    // 2. Get local students from coach's data
    const coachData = await getUserData(coachUsername);
    const localStudents = (coachData.localStudents || []).map((s: any) => ({
        ...s, // Contains id and step1
        username: s.id, // Use ID as the unique identifier
        isLocal: true,
        joinDate: s.joinDate || new Date().toISOString(), // Fallback join date
    }));

    return [...(registeredStudents as any[]), ...localStudents];
};


const getColorForName = (name: string) => {
    const colors = [
        '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
        '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
        '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
    ];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colors.length);
    return colors[index];
};

const renderProgressTimeline = (userData: any) => {
    const events: any[] = [];
    (userData.workoutHistory || []).forEach((log: any) => events.push({ date: new Date(log.date), type: 'workout', data: log }));
    (userData.weightHistory || []).forEach((log: any) => events.push({ date: new Date(log.date), type: 'weight', data: log }));
    (userData.subscriptions || []).forEach((sub: any) => events.push({ date: new Date(sub.purchaseDate), type: 'purchase', data: sub }));
    (userData.programHistory || []).forEach((prog: any) => events.push({ date: new Date(prog.date), type: 'program', data: prog }));

    if (events.length === 0) {
        return '<p class="text-text-secondary text-center p-8">هنوز فعالیتی برای نمایش وجود ندارد.</p>';
    }

    events.sort((a, b) => b.date.getTime() - a.date.getTime());

    const iconMap = {
        workout: { icon: 'dumbbell', color: 'bg-blue-500' },
        weight: { icon: 'bar-chart-2', color: 'bg-green-500' },
        purchase: { icon: 'shopping-cart', color: 'bg-pink-500' },
        program: { icon: 'clipboard-list', color: 'bg-orange-500' },
    };

    let timelineHtml = '<div class="timeline-container pr-4">';
    events.forEach(event => {
        const { icon, color } = iconMap[event.type as keyof typeof iconMap];
        let title = '';
        let description = '';

        switch (event.type) {
            case 'workout':
                title = 'تمرین ثبت شد';
                description = `${event.data.exercises?.length || 0} حرکت انجام شد.`;
                break;
            case 'weight':
                title = 'وزن ثبت شد';
                description = `وزن جدید: ${event.data.weight} کیلوگرم`;
                break;
            case 'purchase':
                title = 'خرید پلن';
                description = `پلن "${event.data.planName}" خریداری شد.`;
                break;
            case 'program':
                title = 'برنامه جدید ارسال شد';
                description = `شامل ${event.data.step2?.days?.length || 0} روز تمرینی`;
                break;
        }

        timelineHtml += `
            <div class="timeline-item relative pb-8">
                <div class="timeline-dot absolute w-4 h-4 rounded-full ${color} border-4 border-bg-secondary"></div>
                <div class="mr-6">
                    <p class="font-semibold text-sm">${title} - <span class="text-text-secondary font-normal">${timeAgo(event.date.toISOString())}</span></p>
                    <p class="text-xs text-text-secondary">${description}</p>
                </div>
            </div>
        `;
    });
    timelineHtml += '</div>';
    return timelineHtml;
};

export const updateCoachNotifications = async (currentUser: string) => {
    const notifications = await getNotifications(currentUser);
    const mainContainer = document.getElementById('coach-dashboard-container');
    if (!mainContainer) return;

    mainContainer.querySelectorAll('.coach-nav-link').forEach(tab => {
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

const saveCurrentPlanAsTemplate = async () => {
    const planData = await programBuilderControls.gatherPlanData();
    if (!planData) {
        showToast("لطفا ابتدا یک برنامه بسازید.", "error");
        return;
    }
    const templateName = prompt("یک نام برای این الگو وارد کنید:");
    if (templateName) {
        await saveTemplate(templateName, planData);
        showToast(`الگوی "${templateName}" با موفقیت ذخیره شد.`, "success");
        await renderTemplatesTab();
    }
};

const renderTemplatesTab = async () => {
    const templatesContainer = document.getElementById('templates-list-container');
    if (!templatesContainer) return;
    
    const templates = await getTemplates();
    if (Object.keys(templates).length === 0) {
        templatesContainer.innerHTML = `<p class="text-text-secondary">هنوز الگویی ذخیره نشده است.</p>`;
        return;
    }
    
    templatesContainer.innerHTML = Object.keys(templates).map(name => `
        <div class="p-4 border border-border-primary rounded-lg flex justify-between items-center">
            <div>
                <p class="font-bold">${name}</p>
                <p class="text-sm text-text-secondary">${templates[name].description || `برنامه تمرینی برای ${templates[name]?.student?.clientName || 'شاگرد'}`}</p>
            </div>
            <div>
                <button class="secondary-button !p-2" data-template-name="${name}" data-action="load-template"><i data-lucide="upload" class="w-4 h-4 pointer-events-none"></i></button>
                <button class="secondary-button !p-2 text-red-accent" data-template-name="${name}" data-action="delete-template"><i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button>
            </div>
        </div>
    `).join('');
    window.lucide?.createIcons();
};

const _renderStudentProgram = (programData: any) => {
    if (!programData || !programData.step2 || !programData.step2.days || programData.step2.days.length === 0) {
        return `<p class="text-text-secondary text-center p-4">هنوز برنامه‌ای برای این شاگرد ثبت نشده است.</p>`;
    }
    const dayColors = ['#3b82f6', '#ef4444', '#f97316', '#10b981', '#a855f7', '#ec4899', '#f59e0b'];

    let programHtml = programData.step2.days.map((day: any, index: number) => {
        const hasExercises = day.exercises && day.exercises.length > 0;
        const dayColor = dayColors[index % dayColors.length];
        return `
        <details class="day-card card !shadow-none !border mb-2">
            <summary class="font-bold cursor-pointer flex justify-between items-center p-3 rounded-md" style="border-right: 4px solid ${dayColor}; background-color: ${hexToRgba(dayColor, 0.1)};">
                <span>${day.name}</span>
                <i data-lucide="chevron-down" class="details-arrow"></i>
            </summary>
            ${hasExercises ? `
            <div class="p-3 border-t border-border-primary">
                <div class="space-y-2">
                    ${(day.exercises || []).map((ex: any) => `
                        <div class="p-2 rounded-lg ${ex.is_superset ? 'is-superset' : 'bg-bg-tertiary/50'}">
                            <p class="font-semibold">${ex.name}</p>
                            <div class="flex items-center gap-4 text-sm text-text-secondary mt-1">
                                <span><span class="font-semibold">${ex.sets}</span> ست</span>
                                <span><span class="font-semibold">${ex.reps}</span> تکرار</span>
                                <span><span class="font-semibold">${ex.rest}</span> ثانیه استراحت</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </details>
        `;
    }).join('');

    if (programData.supplements && programData.supplements.length > 0) {
        programHtml += `
            <h4 class="font-bold text-lg mt-4 mb-2 pt-3 border-t border-border-primary">برنامه مکمل</h4>
            <div class="space-y-2">
            ${programData.supplements.map((sup: any) => `
                <div class="p-2 rounded-lg bg-bg-tertiary/50">
                    <p class="font-semibold">${sup.name}</p>
                    <p class="text-sm text-text-secondary">${sup.dosage} - ${sup.timing}</p>
                    ${sup.notes ? `<p class="text-xs italic text-text-secondary mt-1">یادداشت: ${sup.notes}</p>` : ''}
                </div>
            `).join('')}
            </div>
        `;
    }

    return programHtml;
};

const initStudentWeightChartInModal = (userData: any) => {
    const ctx = document.getElementById('student-modal-weight-chart') as HTMLCanvasElement;
    if (!ctx || !window.Chart) return;

    if (studentModalChartInstance) {
        studentModalChartInstance.destroy();
    }
    const weightHistory = userData.weightHistory || [];
    const labels = weightHistory.map((entry: any) => new Date(entry.date).toLocaleDateString('fa-IR'));
    const data = weightHistory.map((entry: any) => entry.weight);
    studentModalChartInstance = new window.Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Weight (kg)',
                data,
                borderColor: 'var(--accent)',
                backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
};

const openStudentProfileModal = async (studentId: string, coachUsername: string) => {
    const modal = document.getElementById('student-profile-modal');
    if (!modal) return;
    
    const isLocal = studentId.startsWith('local_');
    let userData: any;
    let user: any;

    if (isLocal) {
        const coachData = await getUserData(coachUsername);
        userData = (coachData.localStudents || []).find((s: any) => s.id === studentId);
        if (!userData) return;
        user = { email: userData.step1?.contact || 'شاگرد حضوری', ...userData };
    } else {
        userData = await getUserData(studentId);
        user = (await getUsers()).find((u:any) => u.username === studentId);
    }


    (modal.querySelector('#student-modal-name') as HTMLElement).textContent = userData.step1?.clientName || studentId;
    
    const infoSidebar = modal.querySelector('.w-full.md\\:w-1\\/3') as HTMLElement;
    const lastWeight = (userData.weightHistory?.slice(-1)[0]?.weight || userData.step1?.weight || null);

    if (infoSidebar) {
        const latestProgram = (userData.programHistory && userData.programHistory.length > 0) ? userData.programHistory[0] : null;
        const isEditable = !isLocal && latestProgram && (Date.now() - new Date(latestProgram.date).getTime()) < 48 * 60 * 60 * 1000;
        let buttonHtml = `<button data-action="create-program" data-username="${studentId}" class="primary-button w-full mt-4 !text-sm">ارسال برنامه جدید</button>`;
        if (isEditable) {
            const hoursLeft = Math.round(48 - (Date.now() - new Date(latestProgram.date).getTime()) / (1000*60*60));
            buttonHtml = `<button data-action="edit-recent-program" data-username="${studentId}" class="primary-button w-full mt-4 !text-sm !bg-yellow-500 hover:!bg-yellow-600">ویرایش آخرین برنامه (${hoursLeft} ساعت مانده)</button>`;
        }

        infoSidebar.innerHTML = `
            <div class="p-4 h-full flex flex-col">
                <div class="flex-grow">
                    <h4 class="font-bold mb-3">اطلاعات کلی</h4>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between"><span>هدف:</span> <strong class="font-semibold">${userData.step1?.trainingGoal || 'تعیین نشده'}</strong></div>
                        <div class="flex justify-between"><span>ایمیل/تماس:</span> <strong>${user.email}</strong></div>
                        <div class="flex justify-between"><span>سن:</span> <strong>${(userData.step1?.age || 'N/A')}</strong></div>
                        <div class="flex justify-between"><span>قد (cm):</span> <strong>${(userData.step1?.height || 'N/A')}</strong></div>
                        <div class="flex justify-between"><span>وزن (kg):</span> <strong>${(lastWeight ? lastWeight.toFixed(1) : 'N/A')}</strong></div>
                        <div class="flex justify-between"><span>سطح تجربه:</span> <strong class="font-semibold">${userData.step1?.experienceLevel || 'تعیین نشده'}</strong></div>
                        <div class="flex justify-between"><span>TDEE:</span> <strong>${(Math.round(userData.step1?.tdee) || 'N/A')}</strong></div>
                    </div>
                    ${userData.step1?.limitations ? `
                    <div class="mt-4 pt-4 border-t border-border-primary">
                        <h5 class="font-semibold text-sm mb-1 text-orange-500 flex items-center gap-2"><i data-lucide="shield-alert" class="w-4 h-4"></i>محدودیت‌ها</h5>
                        <p class="text-xs text-text-secondary whitespace-pre-wrap">${sanitizeHTML(userData.step1.limitations)}</p>
                    </div>` : ''}
                    ${userData.step1?.coachNotes ? `
                    <div class="mt-4 pt-4 border-t border-border-primary">
                        <h5 class="font-semibold text-sm mb-1 text-blue-500 flex items-center gap-2"><i data-lucide="notebook-pen" class="w-4 h-4"></i>یادداشت‌های شما</h5>
                        <p class="text-xs text-text-secondary whitespace-pre-wrap">${sanitizeHTML(userData.step1.coachNotes)}</p>
                    </div>` : ''}
                </div>
                ${buttonHtml}
            </div>
        `;
    }


    const programWrapper = modal.querySelector('#student-program-content-wrapper') as HTMLElement;
    const history = userData.programHistory || [];

    // Backward compatibility: if history is empty but old plan exists, create one entry
    if (history.length === 0 && userData.step2) {
        history.push({
            date: userData.joinDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Use join date or fallback
            step2: userData.step2,
            supplements: userData.supplements || []
        });
    }

    if (history.length > 0) {
        programWrapper.innerHTML = history.map((p: any, index: number) => `
            <details class="day-card card !shadow-none !border mb-2" ${index === 0 ? 'open' : ''}>
                <summary class="font-bold cursor-pointer flex justify-between items-center p-3">
                    <span>برنامه تاریخ: ${new Date(p.date).toLocaleDateString('fa-IR')}</span>
                    <i data-lucide="chevron-down" class="details-arrow"></i>
                </summary>
                <div class="p-3 border-t border-border-primary">
                    ${_renderStudentProgram(p)}
                </div>
            </details>
        `).join('');
    } else {
        programWrapper.innerHTML = `<p class="text-text-secondary text-center p-4">هنوز برنامه‌ای برای این شاگرد ثبت نشده است.</p>`;
    }
    
    const progressContent = modal.querySelector('#student-progress-content');
    if (progressContent) {
        progressContent.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                    <h4 class="font-bold mb-3">نمودار وزن</h4>
                    <div class="h-64"><canvas id="student-modal-weight-chart"></canvas></div>
                </div>
                <div>
                    <h4 class="font-bold mb-3">تایم‌لاین فعالیت‌ها</h4>
                    <div class="h-64 overflow-y-auto pr-2">
                        ${renderProgressTimeline(userData)}
                    </div>
                </div>
            </div>
        `;
        initStudentWeightChartInModal(userData);
    }

    const chatTab = modal.querySelector('.student-modal-tab[data-target="student-chat-content"]') as HTMLButtonElement;
    const chatContent = modal.querySelector('#student-chat-content');

    if (isLocal) {
        chatTab.style.display = 'none';
        chatContent.innerHTML = '';
    } else {
        chatTab.style.display = 'block';
    }


    const modalTabs = modal.querySelectorAll('.student-modal-tab');
    const modalContents = modal.querySelectorAll('.student-modal-content');
    modalTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-target');
            modalTabs.forEach(t => t.classList.remove('active-tab'));
            tab.classList.add('active-tab');
            modalContents.forEach(c => c.classList.toggle('hidden', c.id !== targetId));
        });
    });
    if (modalTabs.length > 0) (modalTabs[0] as HTMLElement).click();
    
    // --- Chat Logic ---
    const renderChat = async () => {
        const chatUserData = await getUserData(studentId);
        const messagesContainer = chatContent?.querySelector('#coach-chat-messages-container');
        const messagesInnerContainer = messagesContainer?.querySelector('div');

        if (!messagesContainer || !messagesInnerContainer) return;
        
        const chatHistory = (chatUserData.chatHistory || []);
        messagesInnerContainer.innerHTML = chatHistory.map((msg: any) => `
            <div class="flex ${msg.sender === 'coach' ? 'justify-end' : 'justify-start'}">
                 <div class="message-bubble ${msg.sender === 'coach' ? 'message-sent' : 'message-received'}">
                    <div class="message-content">${sanitizeHTML(msg.message)}</div>
                    <div class="message-timestamp">${timeAgo(msg.timestamp)}</div>
                 </div>
            </div>
        `).join('');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    if (!isLocal) {
        await renderChat();

        const chatForm = chatContent?.querySelector('#coach-chat-form') as HTMLFormElement;
        const chatInput = chatContent?.querySelector('#coach-chat-input') as HTMLInputElement;

        if (chatForm && !chatForm.dataset.listenerAttached) {
            chatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const message = chatInput.value.trim();
                const activeStudentUsername = studentId; // Capture the correct studentId
                if (!message || !activeStudentUsername) return;

                const chatUserData = await getUserData(activeStudentUsername);
                if (!chatUserData.chatHistory) chatUserData.chatHistory = [];
                chatUserData.chatHistory.push({
                    sender: 'coach',
                    message: message,
                    timestamp: new Date().toISOString()
                });
                await saveUserData(activeStudentUsername, chatUserData);
                await setNotification(activeStudentUsername, 'chat-content', '💬');
                chatInput.value = '';
                await renderChat();
            });
            chatForm.dataset.listenerAttached = 'true';
        }
    }


    openModal(modal);
    window.lucide?.createIcons();
};

const getStudentsNeedingAttention = async (students: any[]) => {
    const studentPromises = students.map(async (student) => {
        if (student.isLocal) return null;
        const studentData = await getUserData(student.username);
        const latestPurchase = getLatestPurchase(studentData);
        if (latestPurchase && latestPurchase.fulfilled === false) {
            return { ...student, userData: studentData }; // Attach data
        }
        return null;
    });
    return (await Promise.all(studentPromises)).filter(s => s !== null) as any[];
};

// Helper function to render the coach dashboard tab
const renderDashboardTab = async (currentUser: string, coachData: any) => {
    const students = await getCoachAllStudents(currentUser);
    const needsPlanStudents = await getStudentsNeedingAttention(students);
    const name = coachData.step1?.clientName || currentUser;
    const unreadMessagesCount = (await getUsers())
        .filter(u => u.role === 'user')
        .map(async u => {
            const userData = await getUserData(u.username);
            const lastMessage = (userData.chatHistory || []).slice(-1)[0];
            return lastMessage && lastMessage.sender === 'user' && !lastMessage.read; // Assume 'read' flag
        })
        .filter(Boolean).length;


    const monthlyRevenue = (students.length * 150000 * 0.7).toLocaleString('fa-IR');

    const kpiCards = [
        { title: 'شاگردان فعال', value: students.length, unit: '', icon: 'users', color: 'admin-accent-blue' },
        { title: 'درآمد تخمینی ماهانه', value: monthlyRevenue, unit: 'تومان', icon: 'trending-up', color: 'admin-accent-pink' },
        { title: 'امتیاز شما', value: coachData.performance?.rating?.toFixed(1) || 'N/A', unit: '/ ۵', icon: 'star', color: 'admin-accent-green' },
        { title: 'نرخ نگهداری', value: coachData.performance?.retentionRate || 'N/A', unit: '%', icon: 'award', color: 'admin-accent-orange' }
    ];

    const container = document.getElementById('dashboard-content');
    if (!container) return;

    container.innerHTML = `
        <div class="space-y-6 animate-fade-in">
            <!-- Header and Focus Card -->
            <div class="today-focus-card text-white">
                <h2 class="text-2xl font-bold mb-4">تمرکز امروز، ${name}!</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-white/10 p-4 rounded-lg flex items-center gap-4">
                        <i data-lucide="file-plus-2" class="w-8 h-8 opacity-80 flex-shrink-0"></i>
                        <div>
                            <p class="text-3xl font-bold">${needsPlanStudents.length}</p>
                            <p class="text-sm opacity-80">شاگرد منتظر برنامه</p>
                        </div>
                    </div>
                    <div class="bg-white/10 p-4 rounded-lg flex items-center gap-4">
                        <i data-lucide="message-square-plus" class="w-8 h-8 opacity-80 flex-shrink-0"></i>
                        <div>
                            <p class="text-3xl font-bold">${unreadMessagesCount}</p>
                            <p class="text-sm opacity-80">پیام جدید</p>
                        </div>
                    </div>
                     <div class="bg-white/10 p-4 rounded-lg flex items-center gap-4">
                        <i data-lucide="activity" class="w-8 h-8 opacity-80 flex-shrink-0"></i>
                        <div>
                            <p class="text-3xl font-bold">۳</p>
                            <p class="text-sm opacity-80">شاگرد برای پیگیری</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Left Column -->
                <div class="lg:col-span-2 space-y-6">
                     <!-- KPIs -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        ${kpiCards.map((kpi, index) => `
                            <div class="stat-card animate-fade-in-up" style="animation-delay: ${index * 100}ms;">
                                <div class="icon-container" style="--icon-bg: var(--${kpi.color}); background-color: var(--${kpi.color});"><i data-lucide="${kpi.icon}" class="w-6 h-6 text-white"></i></div>
                                <div>
                                    ${kpi.unit ? `
                                        <div class="flex items-baseline gap-x-1">
                                            <p class="stat-value">${kpi.value}</p>
                                            <p class="text-base font-semibold text-text-secondary">${kpi.unit}</p>
                                        </div>
                                    ` : `
                                        <p class="stat-value">${kpi.value}</p>
                                    `}
                                    <p class="stat-label mt-1">${kpi.title}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <!-- Growth Chart Card -->
                    <div class="admin-chart-container h-96 animate-fade-in-up" style="animation-delay: 600ms;">
                        <h3 class="font-bold mb-4">رشد شاگردان (۶ ماه اخیر)</h3>
                        <canvas id="coach-growth-chart"></canvas>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="lg:col-span-1 space-y-6">
                    <!-- AI Insight Card -->
                    <div class="card p-6 animate-fade-in-up" style="animation-delay: 500ms;">
                        <div class="flex items-center gap-3 mb-3">
                            <i data-lucide="sparkles" class="w-6 h-6 text-accent"></i>
                            <h3 class="font-bold text-lg">پیشنهاد هوشمند</h3>
                        </div>
                        <p id="ai-insight-text" class="text-text-secondary text-sm min-h-[60px]">برای دریافت یک پیشنهاد کاربردی جهت بهبود کسب و کار خود، کلیک کنید.</p>
                        <button id="get-ai-insight-btn" class="secondary-button w-full mt-4 !text-sm">دریافت پیشنهاد</button>
                    </div>
                     <!-- Needs Attention Card -->
                    <div class="card p-6 animate-fade-in-up" style="animation-delay: 400ms;">
                        <h3 class="font-bold text-lg mb-4">نیازمند توجه</h3>
                        <div id="dashboard-needs-attention-list" class="space-y-3">
                            ${needsPlanStudents.length > 0 ? needsPlanStudents.slice(0, 3).map(student => {
                                const studentData = student.userData;
                                const name = studentData.step1?.clientName || student.username;
                                const latestPurchase = getLatestPurchase(studentData);
                                const avatarUrl = studentData.profile?.avatar;
                                const avatarHtml = avatarUrl
                                    ? `<img src="${avatarUrl}" alt="${name}" class="w-10 h-10 rounded-full object-cover">`
                                    : `<div class="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white" style="background-color: ${getColorForName(name)};">
                                        ${name.substring(0, 1).toUpperCase()}
                                       </div>`;

                                return `
                                    <div class="flex justify-between items-center p-2 bg-bg-tertiary rounded-lg transition-all hover:bg-bg-tertiary/70">
                                        <div class="flex items-center gap-3">
                                            ${avatarHtml}
                                            <div>
                                                <p class="font-semibold text-sm">${name}</p>
                                                <p class="text-xs text-text-secondary">${latestPurchase?.planName || ''}</p>
                                            </div>
                                        </div>
                                        <button class="primary-button !py-1 !px-2 !text-xs" data-action="create-program" data-username="${student.username}">ایجاد</button>
                                    </div>
                                `;
                            }).join('') : '<p class="text-text-secondary text-center">هیچ شاگردی منتظر برنامه نیست.</p>'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    window.lucide?.createIcons();

    const chartCtx = document.getElementById('coach-growth-chart') as HTMLCanvasElement;
    if (chartCtx && window.Chart) {
        const existingChart = window.Chart.getChart(chartCtx);
        if (existingChart) existingChart.destroy();
        
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        const blueColor = getComputedStyle(document.documentElement).getPropertyValue('--admin-accent-blue').trim();

        const accentGradient = chartCtx.getContext('2d')!.createLinearGradient(0, 0, 0, 300);
        accentGradient.addColorStop(0, hexToRgba(accentColor, 0.7));
        accentGradient.addColorStop(1, hexToRgba(accentColor, 0.1));

        const blueGradient = chartCtx.getContext('2d')!.createLinearGradient(0, 0, 0, 300);
        blueGradient.addColorStop(0, hexToRgba(blueColor, 0.7));
        blueGradient.addColorStop(1, hexToRgba(blueColor, 0.1));

        new window.Chart(chartCtx, {
            type: 'bar',
            data: {
                labels: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور'],
                datasets: [
                    {
                        label: 'شاگردان جدید',
                        data: [3, 5, 4, 7, 6, 8],
                        backgroundColor: blueGradient,
                        borderColor: blueColor,
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'کل شاگردان فعال',
                        data: [15, 18, 20, 25, 28, 34],
                        backgroundColor: accentGradient,
                        borderColor: accentColor,
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: {
                         grid: { display: false },
                         ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() }
                    },
                    y: { 
                        beginAtZero: true,
                        grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--border-primary').trim() },
                        ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() }
                    }
                },
                plugins: {
                    legend: {
                        display: true, position: 'bottom',
                        labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() }
                    }
                }
            }
        });
    }
};

const renderProfileTab = (currentUser: string, userData: any) => {
    const container = document.getElementById('profile-content');
    if (!container) return;
    const { step1, profile } = userData;
    const name = step1?.coachName || currentUser;
    const avatarUrl = profile?.avatar;
    const initials = (name || '?').charAt(0).toUpperCase();

    container.innerHTML = `
        <div class="card max-w-2xl mx-auto p-6">
            <h2 class="text-xl font-bold mb-6">پروفایل مربی</h2>
            <form id="coach-profile-form" class="space-y-6">
                 <div class="flex items-center gap-4">
                    <label for="coach-profile-avatar-input" class="profile-avatar-upload block">
                        ${avatarUrl ?
                            `<img id="coach-profile-avatar-preview" src="${avatarUrl}" alt="${name}" class="avatar-preview-img">` :
                            `<div id="coach-profile-avatar-initials" class="avatar-initials bg-accent text-bg-secondary flex items-center justify-center text-4xl font-bold">${initials}</div>`
                        }
                        <div class="upload-overlay"><i data-lucide="camera" class="w-8 h-8"></i></div>
                    </label>
                    <input type="file" id="coach-profile-avatar-input" class="hidden" accept="image/*">
                    <p class="text-sm text-text-secondary">برای نمایش بهتر در لیست مربیان، یک عکس پروفایل بارگذاری کنید.</p>
                </div>

                <div class="input-group">
                    <input type="text" id="coach-profile-name" name="coach-profile-name" class="input-field w-full" value="${step1?.coachName || ''}" placeholder=" ">
                    <label for="coach-profile-name" class="input-label">نام نمایشی</label>
                </div>
                <div class="input-group">
                    <input type="text" id="coach-profile-specialization" name="coach-profile-specialization" class="input-field w-full" value="${profile?.specialization || ''}" placeholder=" ">
                    <label for="coach-profile-specialization" class="input-label">تخصص (مثلا: فیتنس، کاهش وزن)</label>
                </div>
                <div class="input-group">
                    <textarea id="coach-profile-bio" name="coach-profile-bio" class="input-field w-full min-h-[100px]" placeholder=" ">${profile?.bio || ''}</textarea>
                    <label for="coach-profile-bio" class="input-label">بیوگرافی کوتاه</label>
                </div>
                <button type="submit" class="primary-button w-full">ذخیره تغییرات</button>
            </form>
        </div>
    `;
};

const renderChatTab = async (currentUser: string) => {
    const container = document.getElementById('chat-content');
    if (!container) return;

    container.innerHTML = `
        <div class="card h-[calc(100vh-12rem)] flex max-w-7xl mx-auto overflow-hidden">
            <!-- Students List -->
            <div class="w-1/3 border-l border-border-primary flex flex-col">
                <div class="p-4 border-b border-border-primary">
                    <h3 class="font-bold text-lg">گفتگوها</h3>
                </div>
                <div id="coach-chat-student-list" class="flex-grow overflow-y-auto">
                    <!-- Student items will be injected here -->
                </div>
            </div>
            <!-- Chat Window -->
            <div id="coach-chat-window" class="w-2/3 flex flex-col">
                <div class="p-8 text-center flex-grow flex flex-col justify-center items-center text-text-secondary">
                    <i data-lucide="messages-square" class="w-12 h-12 mb-4"></i>
                    <p>برای مشاهده گفتگو، یک شاگرد را از لیست انتخاب کنید.</p>
                </div>
            </div>
        </div>
    `;
    window.lucide?.createIcons();

    const studentListContainer = document.getElementById('coach-chat-student-list');
    if (!studentListContainer) return;

    const students = (await getCoachAllStudents(currentUser)).filter(s => !s.isLocal);

    if (students.length === 0) {
        studentListContainer.innerHTML = `<p class="p-4 text-center text-text-secondary">شما هنوز شاگرد آنلاینی ندارید.</p>`;
        return;
    }

    const template = document.getElementById('coach-chat-student-template') as HTMLTemplateElement;

    const studentListHtmlPromises = students.map(async student => {
        const studentData = await getUserData(student.username);
        const name = studentData.step1?.clientName || student.username;
        const lastMessage = (studentData.chatHistory || []).slice(-1)[0];
        const avatarUrl = studentData.profile?.avatar;

        const clone = template.content.cloneNode(true) as DocumentFragment;
        const button = clone.querySelector('button')!;
        button.dataset.username = student.username;

        const avatarContainer = button.querySelector('.student-avatar')!;
        if (avatarUrl) {
            avatarContainer.innerHTML = `<img src="${avatarUrl}" alt="${name}" class="w-full h-full object-cover rounded-full">`;
        } else {
            avatarContainer.textContent = name.substring(0, 1).toUpperCase();
            avatarContainer.setAttribute('style', `background-color: ${getColorForName(name)}`);
        }
        
        (button.querySelector('.student-name') as HTMLElement).textContent = name;

        if (lastMessage) {
            (button.querySelector('.last-message-time') as HTMLElement).textContent = timeAgo(lastMessage.timestamp);
            (button.querySelector('.last-message-snippet') as HTMLElement).textContent = lastMessage.message;
        } else {
            (button.querySelector('.last-message-snippet') as HTMLElement).textContent = 'گفتگویی شروع نشده است.';
        }
        
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(clone);
        return tempDiv.innerHTML;
    });

    studentListContainer.innerHTML = (await Promise.all(studentListHtmlPromises)).join('');

    const loadConversation = async (studentUsername: string) => {
        const chatWindow = document.getElementById('coach-chat-window');
        if (!chatWindow) return;

        document.querySelectorAll('.coach-chat-student-item').forEach(item => {
            item.classList.toggle('active', (item as HTMLElement).dataset.username === studentUsername);
        });

        const studentData = await getUserData(studentUsername);
        const studentUser = (await getUsers()).find((u:any) => u.username === studentUsername);
        const name = studentData.step1?.clientName || studentUsername;
        const avatar = studentData.profile?.avatar;
        
        chatWindow.innerHTML = `
            <div class="chat-header">
                ${avatar ? 
                    `<img src="${avatar}" alt="${name}" class="chat-avatar">` :
                    `<div class="chat-avatar" style="background-color: ${getColorForName(name)}">${name.charAt(0)}</div>`
                }
                <div>
                    <h3 class="font-bold">${name}</h3>
                    <p class="text-xs text-text-secondary">${studentUser.email}</p>
                </div>
            </div>
            <div id="coach-chat-messages-container" class="p-4 flex-grow overflow-y-auto message-container flex flex-col">
                <div class="space-y-4"></div>
            </div>
            <div class="p-4 border-t border-border-primary">
                <div id="coach-quick-replies" class="flex items-center gap-2 mb-2 flex-wrap"></div>
                <form id="coach-chat-form-main" data-username="${studentUsername}" class="flex items-center gap-3">
                    <input id="coach-chat-input-main" type="text" class="input-field flex-grow" placeholder="پیام خود را بنویسید..." autocomplete="off">
                    <button type="submit" class="primary-button !p-3"><i data-lucide="send" class="w-5 h-5"></i></button>
                </form>
            </div>
        `;
        window.lucide?.createIcons();

        const renderMessages = async () => {
            const messagesContainer = chatWindow.querySelector('#coach-chat-messages-container');
            const messagesInnerContainer = messagesContainer?.querySelector('div');
            if (!messagesContainer || !messagesInnerContainer) return;

            const currentData = await getUserData(studentUsername);
            const chatHistory = (currentData.chatHistory || []);
            messagesInnerContainer.innerHTML = chatHistory.map((msg: any) => `
                <div class="flex ${msg.sender === 'coach' ? 'justify-end' : 'justify-start'}">
                    <div class="message-bubble ${msg.sender === 'coach' ? 'message-sent' : 'message-received'}">
                        <div class="message-content">${sanitizeHTML(msg.message)}</div>
                        <div class="message-timestamp">${timeAgo(msg.timestamp)}</div>
                    </div>
                </div>
            `).join('');
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        };

        await renderMessages();

        const quickRepliesContainer = chatWindow.querySelector('#coach-quick-replies');
        if (quickRepliesContainer) {
            const replies = ['برنامه شما در حال آماده سازی است.', 'چطور پیش میره؟', 'عالیه! ادامه بده.'];
            quickRepliesContainer.innerHTML = replies.map(reply => `<button class="quick-reply-btn secondary-button !text-xs !py-1 !px-3">${reply}</button>`).join('');
        }
    };

    studentListContainer.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const studentItem = target.closest<HTMLButtonElement>('.coach-chat-student-item');
        if (studentItem && studentItem.dataset.username) {
            loadConversation(studentItem.dataset.username);
        }
    });

    const chatWindow = document.getElementById('coach-chat-window');
    if (chatWindow && !chatWindow.dataset.listenersAttached) {
        chatWindow.dataset.listenersAttached = 'true';
        
        chatWindow.addEventListener('click', e => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('quick-reply-btn')) {
                const input = document.getElementById('coach-chat-input-main') as HTMLInputElement;
                if (input) {
                    input.value = target.textContent || '';
                    input.focus();
                }
            }
        });

        chatWindow.addEventListener('submit', async e => {
            const form = e.target as HTMLElement;
            if (form.id === 'coach-chat-form-main') {
                e.preventDefault();
                const input = document.getElementById('coach-chat-input-main') as HTMLInputElement;
                const message = input.value.trim();
                const targetUsername = form.dataset.username;

                if (message && targetUsername) {
                    const targetData = await getUserData(targetUsername);
                    if (!targetData.chatHistory) targetData.chatHistory = [];
                    targetData.chatHistory.push({
                        sender: 'coach',
                        message: message,
                        timestamp: new Date().toISOString()
                    });
                    await saveUserData(targetUsername, targetData);
                    await setNotification(targetUsername, 'chat-content', '💬');
                    input.value = '';
                    
                    const messagesContainer = chatWindow.querySelector('#coach-chat-messages-container');
                    const messagesInnerContainer = messagesContainer?.querySelector('div');
                    if(messagesContainer && messagesInnerContainer){
                         messagesInnerContainer.innerHTML += `
                            <div class="flex justify-end">
                                <div class="message-bubble message-sent">
                                    <div class="message-content">${sanitizeHTML(message)}</div>
                                    <div class="message-timestamp">همین الان</div>
                                </div>
                            </div>
                         `;
                         messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                    
                    const studentListItem = studentListContainer.querySelector(`[data-username="${targetUsername}"]`);
                    if (studentListItem) {
                        (studentListItem.querySelector('.last-message-snippet') as HTMLElement).textContent = message;
                        (studentListItem.querySelector('.last-message-time') as HTMLElement).textContent = 'همین الان';
                    }
                }
            }
        });
    }

    if (students.length > 0) {
        await loadConversation(students[0].username);
    }
};

const renderStudentCards = async (students: any[], containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (students.length === 0) {
        container.innerHTML = `<p class="text-text-secondary text-center col-span-full py-8">موردی برای نمایش یافت نشد.</p>`;
        return;
    }

    const studentCardsHtmlPromises = students.map(async student => {
        const studentData = student.isLocal ? student : await getUserData(student.username);
        const name = studentData.step1?.clientName || student.username;
        const goal = studentData.step1?.trainingGoal || 'بدون هدف';
        const lastActivityDate = getLastActivityDate(studentData);
        const lastActivity = lastActivityDate ? timeAgo(lastActivityDate.toISOString()) : "بدون فعالیت";

        // Status Logic
        let statusText = 'غیرفعال';
        let statusColor = 'bg-red-500';
        const latestPurchase = student.isLocal ? null : getLatestPurchase(studentData);
        const needsPlan = !student.isLocal && latestPurchase && latestPurchase.fulfilled === false;
        
        if (needsPlan) {
            statusText = 'در انتظار برنامه';
            statusColor = 'bg-yellow-500';
        } else if (lastActivityDate && (Date.now() - lastActivityDate.getTime()) < 7 * 24 * 60 * 60 * 1000) {
            statusText = 'فعال';
            statusColor = 'bg-green-500';
        }

        // Adherence Logic
        const completedWorkouts = getWorkoutsThisWeek(studentData.workoutHistory);
        const plannedWorkouts = studentData.step1?.trainingDays || 0;
        const adherencePercentage = plannedWorkouts > 0 ? Math.min(100, Math.round((completedWorkouts / plannedWorkouts) * 100)) : 0;
        
        const avatarUrl = studentData.profile?.avatar;
        const avatarHtml = avatarUrl
            ? `<img src="${avatarUrl}" alt="${name}" class="w-14 h-14 rounded-full object-cover">`
            : `<div class="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xl text-white" style="background-color: ${getColorForName(name)};">${name.substring(0, 1).toUpperCase()}</div>`;

        return `
            <div class="student-card card p-4 flex flex-col gap-4 animate-fade-in ${needsPlan ? 'needs-attention-highlight' : ''}">
                <!-- Header -->
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-3 overflow-hidden">
                        ${avatarHtml}
                        <div class="overflow-hidden">
                            <h3 class="font-bold text-lg truncate">${name}</h3>
                            <p class="text-sm text-text-secondary truncate">${goal}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 text-xs font-semibold flex-shrink-0">
                        <div class="status-dot ${statusColor}"></div>
                        <span>${statusText}</span>
                    </div>
                </div>

                <!-- Adherence -->
                <div>
                    <div class="flex justify-between items-center text-xs mb-1">
                        <span class="font-semibold text-text-secondary">پایبندی هفتگی</span>
                        <span>${completedWorkouts} / ${plannedWorkouts || '?'}</span>
                    </div>
                    <div class="adherence-progress-bar-container">
                        <div class="adherence-progress-bar-fill" style="width: ${adherencePercentage}%;"></div>
                    </div>
                </div>

                <!-- Last Activity -->
                <div class="text-xs text-text-secondary">
                    <span>آخرین فعالیت:</span>
                    <span class="font-semibold">${lastActivity}</span>
                </div>

                <!-- Actions -->
                <div class="mt-auto pt-3 border-t border-border-primary flex items-center gap-2">
                    <button class="primary-button !py-1 !px-3 !text-xs flex-1" data-action="view-student-profile" data-username="${student.id}">مشاهده پروفایل</button>
                    ${!student.isLocal ? `<button class="secondary-button !py-1 !px-3 !text-xs" data-action="chat-with-student" data-username="${student.username}"><i data-lucide="message-square" class="w-4 h-4"></i></button>` : ''}
                    ${student.isLocal ? `<button class="secondary-button !py-1 !px-3 !text-xs" data-action="edit-local-student" data-username="${student.id}"><i data-lucide="edit" class="w-4 h-4"></i></button>` : ''}
                </div>
            </div>
        `;
    });

    const studentCardsHtml = await Promise.all(studentCardsHtmlPromises);
    container.innerHTML = studentCardsHtml.join('');
    window.lucide?.createIcons();
};

export async function initCoachDashboard(currentUser: string, handleLogout: () => void, handleGoToHome: () => void, coachTier: string) {
    const mainContainer = document.getElementById('coach-dashboard-container');
    if (!mainContainer) return;

    // Scoped event listeners for persistent elements
    mainContainer.querySelector('#logout-btn')?.addEventListener('click', handleLogout);
    mainContainer.querySelector('#go-to-home-btn')?.addEventListener('click', handleGoToHome);

    programBuilderControls = initProgramBuilder(
        currentUser, 
        (studentId) => {
            // onProgramSent callback
            const studentsTab = document.querySelector('[data-target="students-content"]');
            if (studentsTab) switchTab(studentsTab as HTMLElement);
        },
        getCoachAllStudents,
        openSelectionModal
    );

    const pageTitles: Record<string, { title: string, subtitle: string }> = {
        'dashboard-content': { title: 'داشبورد', subtitle: 'خلاصه فعالیت‌ها و آمار شما.' },
        'students-content': { title: 'شاگردان', subtitle: 'تمام شاگردان خود را مدیریت کنید.' },
        'chat-content': { title: 'گفتگو', subtitle: 'با شاگردان خود در ارتباط باشید.' },
        'program-builder-content': { title: 'برنامه‌ساز', subtitle: 'برنامه‌های تمرینی و غذایی جدید بسازید.' },
        'templates-content': { title: 'الگوها', subtitle: 'الگوهای برنامه خود را مدیریت کنید.' },
        'magazine-content': { title: 'مجله', subtitle: 'مقالات خود را مدیریت کنید.' },
        'team-content': { title: 'تیم من', subtitle: 'عملکرد مربیان تیم خود را مشاهده کنید.' },
        'profile-content': { title: 'پروفایل', subtitle: 'اطلاعات و پروفایل عمومی خود را ویرایش کنید.' }
    };

    const switchTab = async (activeTab: HTMLElement) => {
        const targetId = activeTab.getAttribute('data-target');
        if (!targetId) return;

        mainContainer.querySelectorAll('.coach-nav-link').forEach(t => t.classList.remove('active-nav-link'));
        activeTab.classList.add('active-nav-link');
        mainContainer.querySelectorAll('.coach-tab-content').forEach(content => {
            content.classList.toggle('hidden', content.id !== targetId);
        });

        const targetData = pageTitles[targetId];
        const titleEl = document.getElementById('coach-page-title');
        const subtitleEl = document.getElementById('coach-page-subtitle');
        if (titleEl && subtitleEl && targetData) {
            titleEl.textContent = targetData.title;
            subtitleEl.textContent = targetData.subtitle;
        }
        
        await clearNotification(currentUser, targetId);
        await updateCoachNotifications(currentUser);
        
        const pageContainer = document.getElementById(targetId);
        if (pageContainer && targetId !== 'program-builder-content') {
            pageContainer.innerHTML = `<div class="flex justify-center items-center p-16"><div class="w-12 h-12 rounded-full animate-spin border-4 border-dashed border-accent border-t-transparent"></div></div>`;
        }
        await new Promise(resolve => setTimeout(resolve, 50));

        switch (targetId) {
            case 'dashboard-content':
                const coachDataForDashboard = await getUserData(currentUser);
                await renderDashboardTab(currentUser, coachDataForDashboard);
                break;
            case 'students-content':
                await renderStudentsTab(currentUser);
                break;
            case 'chat-content':
                await renderChatTab(currentUser);
                break;
            case 'program-builder-content':
                // The builder is self-contained and already rendered. No action needed.
                break;
            case 'templates-content':
                const templatesContainer = document.getElementById('templates-content');
                if (templatesContainer) {
                    templatesContainer.innerHTML = `
                        <div class="card p-6">
                            <div class="flex justify-between items-center mb-4">
                                <h3 class="font-bold text-lg">الگوهای برنامه</h3>
                                <button data-action="save-template" class="primary-button !text-sm">ذخیره برنامه فعلی به عنوان الگو</button>
                            </div>
                            <div id="templates-list-container" class="space-y-2"></div>
                        </div>`;
                    await renderTemplatesTab();
                }
                break;
            case 'magazine-content':
                await renderCoachMagazineTab(currentUser);
                break;
            case 'team-content':
                await renderCoachTeamTab(currentUser);
                break;
            case 'profile-content':
                const coachData = await getUserData(currentUser);
                renderProfileTab(currentUser, coachData);
                break;
        }
    };
    
    // Main event listener for the entire dashboard
    mainContainer.addEventListener('click', async e => {
        if (!(e.target instanceof HTMLElement)) return;
        const target = e.target;

        if (target.id === 'get-ai-insight-btn') {
            const btn = target as HTMLButtonElement;
            const insightTextEl = document.getElementById('ai-insight-text');
            const coachData = await getUserData(currentUser);
            if (!insightTextEl) return;
        
            btn.classList.add('is-loading');
            btn.disabled = true;
            insightTextEl.textContent = 'در حال تحلیل داده‌ها...';
        
            try {
                const students = await getCoachAllStudents(currentUser);
                const insight = await generateCoachingInsight(coachData, students);
                if (insight) {
                    insightTextEl.textContent = insight;
                    insightTextEl.classList.add('animate-fade-in');
                } else {
                    insightTextEl.textContent = 'خطا در دریافت پیشنهاد. لطفاً دوباره تلاش کنید.';
                }
            } catch (error) {
                console.error("AI Insight Error:", error);
                insightTextEl.textContent = 'خطا در دریافت پیشنهاد. لطفاً دوباره تلاش کنید.';
                showToast("خطا در ارتباط با سرویس هوش مصنوعی", "error");
            } finally {
                btn.classList.remove('is-loading');
                btn.disabled = false;
            }
            return;
        }

        const closeModalBtn = target.closest('.close-modal-btn');
        if (closeModalBtn) {
            closeModal(closeModalBtn.closest('.modal'));
            return;
        }
        
        if (target.classList.contains('modal')) {
            closeModal(target);
            return;
        }
        
        const navLink = target.closest<HTMLElement>('.coach-nav-link');
        if (navLink) {
            await switchTab(navLink);
            return;
        }
        
        const actionBtn = target.closest<HTMLButtonElement>('[data-action]');
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            const username = actionBtn.dataset.username;
            const templateName = actionBtn.dataset.templateName;

            switch(action) {
                case 'view-student-profile': if(username) await openStudentProfileModal(username, currentUser); break;
                case 'add-local-student': openLocalClientModalForEdit(null, currentUser); break;
                case 'edit-local-student': if(username) await openLocalClientModalForEdit(username, currentUser); break;
                case 'create-program': {
                    const programBuilderTab = document.querySelector<HTMLElement>('.coach-nav-link[data-target="program-builder-content"]');
                    if (programBuilderTab) {
                        await switchTab(programBuilderTab);
                        if (username) {
                            await programBuilderControls.openForNewProgram(username);
                        }
                    }
                    break;
                }
                case 'edit-recent-program': {
                    const programBuilderTab = document.querySelector<HTMLElement>('.coach-nav-link[data-target="program-builder-content"]');
                    if (programBuilderTab) {
                        await switchTab(programBuilderTab);
                        if(username) {
                            await programBuilderControls.openForEditing(username);
                        }
                    }
                    break;
                }
                case 'chat-with-student':
                    const chatTab = document.querySelector<HTMLElement>('.coach-nav-link[data-target="chat-content"]');
                    if(chatTab) {
                        await switchTab(chatTab);
                        const studentItem = document.querySelector<HTMLElement>(`.coach-chat-student-item[data-username="${username}"]`);
                        if(studentItem) studentItem.click();
                    }
                    break;
                case 'save-template': await saveCurrentPlanAsTemplate(); break;
                case 'load-template':
                     if (templateName) {
                        // This logic is now inside programBuilder.ts
                     }
                    break;
                case 'delete-template':
                    if (templateName && confirm(`آیا از حذف الگوی "${templateName}" مطمئن هستید؟`)) {
                        await deleteTemplate(templateName);
                        showToast('الگو حذف شد.', 'success');
                        await renderTemplatesTab();
                    }
                    break;
                case 'add-article': await openArticleModal(null, currentUser); break;
                case 'edit-article': {
                    const articleId = actionBtn.dataset.id;
                    if (articleId) await openArticleModal(articleId, currentUser);
                    break;
                }
                case 'delete-article': {
                    const articleId = actionBtn.dataset.id;
                    if (articleId && confirm('آیا از حذف این مقاله مطمئن هستید؟')) {
                        let articles = await getMagazineArticles();
                        const articleToDelete = articles.find(a => a.id === articleId && a.author === currentUser);
                        if (articleToDelete) {
                            await saveMagazineArticles(articles.filter(a => a.id !== articleId));
                            showToast('مقاله حذف شد.', 'success');
                            await renderCoachMagazineTab(currentUser);
                        } else {
                            showToast('شما اجازه حذف این مقاله را ندارید.', 'error');
                        }
                    }
                    break;
                }
            }
            return;
        }
    });

    mainContainer.addEventListener('submit', async (e: Event) => {
        const form = e.target as HTMLFormElement;
        // ... (other form submissions like profile, magazine, local-client)
    });
    
    mainContainer.addEventListener('input', e => {
        // ... (input listeners, now mostly for profile tab)
    });

    const defaultTab = mainContainer.querySelector<HTMLElement>('.coach-nav-link');
    if(defaultTab) await switchTab(defaultTab);
}

const openSelectionModal = (options: string[], title: string, target: HTMLElement) => {
    // This function can now be simpler or removed if the builder is the only consumer
    // For now, it remains as a dependency for the builder
};

const renderStudentsTab = async (coachUsername: string) => {
    const container = document.getElementById('students-content');
    if (!container) return;

    container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
            <div class="relative flex-grow">
                <i data-lucide="search" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary"></i>
                <input type="search" id="students-search-input" class="input-field w-full !pr-10" placeholder="جستجوی شاگرد...">
            </div>
            <div class="flex items-center gap-2 flex-wrap">
                <div id="students-filter-chips" class="flex items-center gap-2">
                    <span class="filter-chip active" data-filter="all">همه</span>
                    <span class="filter-chip" data-filter="needs_plan">در انتظار</span>
                    <span class="filter-chip" data-filter="inactive">غیرفعال</span>
                </div>
                <select id="students-sort-select" class="input-field !text-sm">
                    <option value="name">مرتب‌سازی: نام</option>
                    <option value="activity">مرتب‌سازی: آخرین فعالیت</option>
                    <option value="join_date">مرتب‌سازی: تاریخ عضویت</option>
                </select>
                <button data-action="add-local-student" class="primary-button !py-2 !px-3 !text-sm"><i data-lucide="plus" class="w-4 h-4"></i></button>
            </div>
        </div>
        <div id="all-students-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <!-- Student cards will be rendered here -->
        </div>
    `;

    const searchInput = container.querySelector('#students-search-input');
    const filterChips = container.querySelector('#students-filter-chips');
    const sortSelect = container.querySelector('#students-sort-select');

    const updateView = async () => {
        const allStudents = await getCoachAllStudents(coachUsername);
        const studentDataWithDetailsPromises = allStudents.map(async (s: any) => {
            const userData = s.isLocal ? s : await getUserData(s.username);
            const lastActivityDate = getLastActivityDate(userData);
            return {
                ...s,
                details: userData,
                name: userData.step1?.clientName || s.username,
                lastActivityTimestamp: lastActivityDate ? lastActivityDate.getTime() : new Date(s.joinDate).getTime()
            };
        });

        const studentDataWithDetails = await Promise.all(studentDataWithDetailsPromises);

        const filter = (filterChips?.querySelector('.filter-chip.active') as HTMLElement)?.dataset.filter || 'all';
        const sortBy = (sortSelect as HTMLSelectElement)?.value || 'name';
        const searchTerm = (searchInput as HTMLInputElement)?.value.toLowerCase();

        let finalStudents = studentDataWithDetails.filter(s => {
            if (searchTerm && !s.name.toLowerCase().includes(searchTerm)) return false;
            if (filter === 'needs_plan') {
                if (s.isLocal) return false;
                const latestPurchase = getLatestPurchase(s.details);
                return latestPurchase && !latestPurchase.fulfilled;
            }
            if (filter === 'inactive') {
                const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                return s.lastActivityTimestamp < oneWeekAgo;
            }
            return true;
        });

        finalStudents.sort((a, b) => {
            if (sortBy === 'activity') return b.lastActivityTimestamp - a.lastActivityTimestamp;
            if (sortBy === 'join_date') return new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime();
            return a.name.localeCompare(b.name, 'fa');
        });

        await renderStudentCards(finalStudents, 'all-students-grid');
    };

    searchInput?.addEventListener('input', updateView);
    sortSelect?.addEventListener('change', updateView);
    filterChips?.addEventListener('click', e => {
        const chip = (e.target as HTMLElement).closest('.filter-chip');
        if (chip) {
            filterChips.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            updateView();
        }
    });

    await updateView();
    window.lucide?.createIcons();
};

const openLocalClientModalForEdit = async (studentId: string | null, coachUsername: string) => {
    // ... Implementation remains here
};

const renderCoachMagazineTab = async (currentUser: string) => {
    // ... Implementation remains here
};

const renderCoachTeamTab = async (currentUser: string) => {
    // ... Implementation remains here
};

const openArticleModal = async (articleId: string | null = null, currentUser: string) => {
    // ... Implementation remains here
};
