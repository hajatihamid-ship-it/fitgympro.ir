import { renderLandingPage, initLandingPageListeners } from './ui/landing';
import { renderAuthModal, initAuthListeners } from './ui/authModal';
import { renderCoachDashboard, initCoachDashboard, updateCoachNotifications } from './ui/coachDashboard';
import { renderUserDashboard, initUserDashboard, updateUserNotifications } from './ui/userDashboard';
import { renderAdminDashboard, initAdminDashboard } from './ui/adminDashboard';
import { getUsers, getUserData, saveUsers, saveUserData, addActivityLog, saveDiscounts, getStorePlans, saveStorePlans, seedCMSData, getSiteSettings, idbSet, idbGet, idbDel } from './services/storage';
import { setCurrentUser, getCurrentUser } from './state';
import { sanitizeHTML, applySiteSettings } from './utils/dom';

let notificationInterval: number | null = null;
let themeListenerAttached = false;

const seedInitialUsers = async () => {
    const users = await getUsers();
    if (users.length === 0) {
        console.log("No users found. Seeding initial admin, coach, and user.");
        const initialUsers = [
             { username: "admin10186", email: "admin@fitgympro.com", password: "admin10186", role: "admin", status: "active", coachStatus: null, joinDate: new Date().toISOString() },
             { username: "coach10186", email: "coach@fitgympro.com", password: "coach10186", role: "coach", coachTier: "pro", status: "active", coachStatus: "verified", joinDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
             { username: "coach_pending", email: "newcoach@fitgympro.com", password: "password123", role: "coach", coachTier: "standard", status: "active", coachStatus: "pending", joinDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
             { username: "user_active", email: "user@fitgympro.com", password: "password123", role: "user", status: "active", coachStatus: null, joinDate: new Date().toISOString() },
             { username: "user_suspended", email: "suspended@fitgympro.com", password: "password123", role: "user", status: "suspended", coachStatus: null, joinDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
             { username: "user_needs_plan", email: "needsplan@fitgympro.com", password: "password123", role: "user", status: "active", coachStatus: null, joinDate: new Date().toISOString() },
             { username: "hamid_hajati", email: "hamid.h@fitgympro.com", password: "password123", role: "coach", coachTier: "standard", status: "active", coachStatus: "verified", joinDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
             { username: "morteza_heydari", email: "morteza.h@fitgympro.com", password: "password123", role: "coach", coachTier: "pro", status: "active", coachStatus: "verified", joinDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString() },
             { username: "khorshidi_m", email: "khorshidi.m@fitgympro.com", password: "password123", role: "coach", coachTier: "standard", status: "active", coachStatus: "revoked", joinDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() },
             { username: "sara_ahmadi", email: "sara.a@fitgympro.com", password: "password123", role: "coach", coachTier: "standard", headCoach: "headcoach", status: "active", coachStatus: "verified", joinDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString() },
             { username: "headcoach", email: "head@fitgympro.com", password: "password123", role: "coach", coachTier: "head_coach", status: "active", coachStatus: "verified", joinDate: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString() }
        ];
        await saveUsers(initialUsers);
        
        // --- Seed individual user data for ALL users ---
        await saveUserData("admin10186", {
             step1: { clientName: "Admin" }
        });

        await saveUserData("coach10186", {
             step1: { coachName: "Coach Verified", clientName: "Coach Verified", gender: "مرد" },
             students: 28,
             performance: {
                 rating: 4.8,
                 nps: 85,
                 retentionRate: 92,
                 avgProgramDeliveryHours: 10
             }
        });
        
        await saveUserData("headcoach", {
             step1: { coachName: "سرمربی", clientName: "سرمربی", gender: "مرد" },
             students: 12, // Manages a team, but might also have own clients
             performance: {
                 rating: 4.9,
                 nps: 95,
                 retentionRate: 95,
                 avgProgramDeliveryHours: 8
             }
        });

        await saveUserData("coach_pending", {
             step1: { coachName: "Coach Pending", clientName: "Coach Pending" }
        });
        
        await saveUserData("user_suspended", {
            step1: { clientName: "User Suspended", clientEmail: "suspended@fitgympro.com" },
            joinDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        });

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dayBeforeYesterday = new Date();
        dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);

        const userWorkoutData = {
            step1: {
                clientName: "User Active",
                clientEmail: "user@fitgympro.com",
                coachName: "coach10186",
                age: 28,
                height: 178,
                weight: 78,
                gender: "مرد",
                activityLevel: 1.55,
                trainingGoal: "افزایش حجم",
                trainingDays: 4,
                mobile: "09123456789",
                neck: 40,
                waist: 85,
                hip: 95
            },
            joinDate: new Date().toISOString(),
            programHistory: [{
                date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                step2: {
                    days: [{
                        name: "شنبه: سینه و پشت بازو",
                        exercises: [
                            { name: "پرس سینه هالتر", sets: 4, reps: 10, rest: 60, is_superset: false },
                            { name: "پشت بازو سیم‌کش", sets: 4, reps: 12, rest: 60, is_superset: false },
                            { name: "قفسه سینه دمبل", sets: 3, reps: 12, rest: 45, is_superset: true },
                            { name: "دیپ پارالل", sets: 3, reps: 15, rest: 45, is_superset: true },
                        ]
                    }, {
                        name: "یکشنبه: پشت و جلو بازو",
                         exercises: [
                            { name: "ددلیفت", sets: 4, reps: 6, rest: 120, is_superset: false },
                            { name: "بارفیکس دست باز", sets: 4, reps: 10, rest: 75, is_superset: false },
                            { name: "جلو بازو هالتر", sets: 3, reps: 12, rest: 45, is_superset: false },
                        ]
                    }, {
                        name: "دوشنبه: پا",
                        exercises: [
                            { name: "اسکوات با هالتر", sets: 5, reps: 8, rest: 90, is_superset: false },
                            { name: "پرس پا", sets: 4, reps: 12, rest: 60, is_superset: false },
                            { name: "پشت پا ماشین خوابیده", sets: 4, reps: 15, rest: 45, is_superset: false },
                        ]
                    }, {
                        name: "سه‌شنبه: استراحت",
                        exercises: []
                    }, {
                        name: "چهارشنبه: سرشانه",
                         exercises: [
                            { name: "پرس سرشانه هالتر", sets: 4, reps: 8, rest: 75, is_superset: false },
                            { name: "نشر از جانب دمبل", sets: 4, reps: 12, rest: 60, is_superset: false },
                            { name: "فیس پول", sets: 3, reps: 15, rest: 45, is_superset: false },
                        ]
                    }, {
                        name: "پنجشنبه: فول بادی (اختیاری)",
                         exercises: [
                            { name: "اسکوات گابلت", sets: 3, reps: 12, rest: 60, is_superset: false },
                            { name: "شنا سوئدی", sets: 3, reps: 15, rest: 60, is_superset: false },
                            { name: "پلانک", sets: 3, reps: 60, rest: 60, is_superset: false },
                        ]
                    }, {
                        name: "جمعه: استراحت",
                        exercises: []
                    }],
                    notes: "قبل از هر تمرین ۵ دقیقه گرم کنید. بعد از تمرین حرکات کششی فراموش نشود. به میزان کافی آب بنوشید و روی کیفیت خواب تمرکز کنید."
                },
                supplements: []
            }],
            chatHistory: [
                { sender: 'coach', message: 'سلام! برنامه جدیدت رو ارسال کردم. حتما بررسی کن.', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
                { sender: 'user', message: 'ممنون مربی، عالیه!', timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() }
            ],
            workoutHistory: [
                {
                    date: dayBeforeYesterday.toISOString(),
                    dayIndex: 1,
                    exercises: [
                        { name: 'ددلیفت', sets: [{weight: 100, reps: 6}, {weight: 100, reps: 6}, {weight: 105, reps: 5}, {weight: 105, reps: 5}] },
                        { name: 'بارفیکس دست باز', sets: [{reps: 10}, {reps: 9}, {reps: 8}, {reps: 8}] },
                        { name: 'جلو بازو هالتر', sets: [{weight: 30, reps: 12}, {weight: 30, reps: 11}, {weight: 30, reps: 10}] }
                    ]
                },
                {
                    date: yesterday.toISOString(),
                    dayIndex: 2,
                    exercises: [
                        { name: 'اسکوات با هالتر', sets: [{weight: 80, reps: 8}, {weight: 80, reps: 8}, {weight: 85, reps: 7}, {weight: 85, reps: 7}, {weight: 85, reps: 6}] },
                        { name: 'پرس پا', sets: [{weight: 150, reps: 12}, {weight: 150, reps: 12}, {weight: 160, reps: 10}, {weight: 160, reps: 10}] }
                    ]
                }
            ],
            weightHistory: [
                { date: '2024-05-01', weight: 78 }, 
                { date: '2024-05-15', weight: 79.5 }, 
                { date: '2024-06-01', weight: 79 },
                { date: '2024-06-15', weight: 80.2 },
                { date: '2024-07-01', weight: 81 }
            ]
        };
        await saveUserData("user_active", userWorkoutData);

        await saveUserData("user_needs_plan", {
            step1: { clientName: "User Needs Plan", clientEmail: "needsplan@fitgympro.com", coachName: "coach10186" },
            joinDate: new Date().toISOString(),
            subscriptions: [{
                planId: 'full-3m',
                planName: 'پکیج کامل ۳ ماهه',
                price: 400000,
                purchaseDate: new Date().toISOString(),
                fulfilled: false,
                access: ['workout_plan', 'nutrition_plan', 'chat']
            }]
        });

        await saveUserData("hamid_hajati", {
             step1: { coachName: "حمید حاجتی", clientName: "حمید حاجتی", gender: "مرد" },
             profile: {
                 avatar: "https://i.pravatar.cc/150?u=hamid_hajati",
                 specialization: "فیتنس، کاهش وزن",
                 bio: "مربی با سابقه در زمینه کاهش وزن و تناسب اندام."
             },
             students: 15,
             performance: {
                 rating: 4.5,
                 nps: 78,
                 retentionRate: 85,
                 avgProgramDeliveryHours: 14
             }
        });
        await saveUserData("morteza_heydari", {
             step1: { coachName: "مرتضی حیدری نسب", clientName: "مرتضی حیدری نسب", gender: "مرد" },
             profile: {
                 avatar: "https://i.pravatar.cc/150?u=morteza_heydari",
                 specialization: "افزایش حجم، پاورلیفتینگ",
                 bio: "متخصص در برنامه‌های افزایش حجم و قدرت."
             },
             students: 22,
             performance: {
                 rating: 4.9,
                 nps: 91,
                 retentionRate: 88,
                 avgProgramDeliveryHours: 11
             }
        });
        await saveUserData("khorshidi_m", {
             step1: { coachName: "خورشیدی مهر", clientName: "خورشیدی مهر", gender: "مرد" },
             profile: {
                 avatar: "https://i.pravatar.cc/150?u=khorshidi_m",
                 specialization: "حرکات اصلاحی، آمادگی جسمانی",
                 bio: "مربی فانکشنال و حرکات اصلاحی."
             },
             students: 18,
             performance: {
                 rating: 4.2,
                 nps: 72,
                 retentionRate: 79,
                 avgProgramDeliveryHours: 18
             }
        });

        await saveUserData("sara_ahmadi", {
             step1: { coachName: "سارا احمدی", clientName: "سارا احمدی", gender: "زن" },
             profile: {
                 avatar: "https://i.pravatar.cc/150?u=sara_ahmadi",
                 specialization: "فیتنس بانوان، یوگا",
                 bio: "متخصص تناسب اندام و یوگا برای بانوان."
             },
             students: 12,
             performance: {
                 rating: 4.7,
                 nps: 82,
                 retentionRate: 90,
                 avgProgramDeliveryHours: 12
             }
        });


        await addActivityLog("Initial users (admin, coaches, users) were created automatically.");
        await saveDiscounts({ 'WELCOME10': { type: 'percentage', value: 10 }, 'SAVE50K': { type: 'fixed', value: 50000 } });
        await addActivityLog("Initial discount codes created.");
    }
     // Seed plans if they don't exist
     const plans = await getStorePlans();
    if (plans.length === 0) {
        const initialPlans = [
            { planId: 'basic-1m', planName: 'پکیج پایه ۱ ماهه', description: 'ایده‌آل برای شروع و آشنایی.', price: 150000, features: ['برنامه تمرینی اختصاصی', 'پشتیبانی پایه در چت'], emoji: '💪', color: '#3b82f6', access: ['workout_plan', 'chat'] },
            { planId: 'full-3m', planName: 'پکیج کامل ۳ ماهه', description: 'بهترین گزینه برای نتایج پایدار.', price: 400000, features: ['برنامه تمرینی اختصاصی', 'برنامه غذایی هوشمند', 'پشتیبانی کامل در چت', 'تحلیل هفتگی پیشرفت'], emoji: '🚀', color: '#ec4899', recommended: true, access: ['workout_plan', 'nutrition_plan', 'chat'] },
            { planId: 'pro-6m', planName: 'پکیج حرفه‌ای ۶ ماهه', description: 'برای ورزشکاران جدی و اهداف بزرگ.', price: 700000, features: ['تمام ویژگی‌های کامل', 'تماس ویدیویی ماهانه', 'اولویت در پشتیبانی'], emoji: '⭐', color: '#f97316', access: ['workout_plan', 'nutrition_plan', 'chat'] },
            { planId: 'nutrition-1m', planName: 'برنامه غذایی ۱ ماهه', description: 'فقط برنامه غذایی تخصصی.', price: 100000, features: ['برنامه غذایی هوشمند', 'پشتیبانی تغذیه در چت'], emoji: '🥗', color: '#10b981', access: ['nutrition_plan', 'chat'] }
        ];
        await saveStorePlans(initialPlans);
        await addActivityLog("Initial store plans were created automatically.");
    }
};

const updateAllNotifications = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const users = await getUsers();
    const user = users.find((u: any) => u.username === currentUser);
    if (!user) return;

    if (user.role === 'coach') {
        await updateCoachNotifications(currentUser);
    } else if (user.role === 'user') {
        await updateUserNotifications(currentUser);
    }
};

export const renderApp = async () => {
    const appContainer = document.getElementById('app-root');
    if (!appContainer) return;
    
    // Stop any previously running interval.
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
    }

    const lastUser = await idbGet<string>("fitgympro_last_user");
    setCurrentUser(lastUser || null);
    const currentUser = getCurrentUser();

    if (!currentUser) {
        appContainer.innerHTML = await renderLandingPage() + renderAuthModal();
        initLandingPageListeners();
        initAuthListeners(handleLoginSuccess);
    } else {
        const users = await getUsers();
        const currentUserData = users.find((u: any) => u.username === currentUser);
        if (!currentUserData) {
            await handleLogout();
            return;
        }

        const userData = await getUserData(currentUser);
        const handleGoToHome = async () => {
            if (!appContainer) return;
            appContainer.innerHTML = await renderLandingPage() + renderAuthModal();
            initLandingPageListeners();
            initAuthListeners(handleLoginSuccess);
            window.lucide?.createIcons();
            setTimeout(() => {
                const mainContainer = document.querySelector('.landing-page-wrapper');
                if (mainContainer) {
                    mainContainer.classList.add('opacity-100');
                }
            }, 50);
        };

        switch (currentUserData.role) {
            case 'admin':
                appContainer.innerHTML = await renderAdminDashboard();
                await initAdminDashboard(handleLogout, handleLoginSuccess, handleGoToHome);
                break;
            case 'coach':
                const coachTier = currentUserData.coachTier || 'standard';
                appContainer.innerHTML = renderCoachDashboard(currentUser, userData, coachTier);
                await initCoachDashboard(currentUser, handleLogout, handleGoToHome, coachTier);
                break;
            case 'user':
                appContainer.innerHTML = await renderUserDashboard(currentUser, userData);
                await initUserDashboard(currentUser, userData, handleLogout, handleGoToHome);
                break;
            default:
                await handleLogout();
                return;
        }
        
        await updateAllNotifications();
        // Start a new interval for live notifications.
        notificationInterval = window.setInterval(updateAllNotifications, 3000);
    }
    
    // Handle impersonation banner
    const impersonatingAdmin = sessionStorage.getItem("impersonating_admin");
    if (impersonatingAdmin && currentUser && currentUser !== impersonatingAdmin) {
        const placeholder = document.getElementById('impersonation-banner-placeholder');
        if (placeholder) {
            placeholder.innerHTML = `
            <div class="bg-orange-500 text-white p-3 text-center font-semibold flex items-center justify-center gap-4 mb-6 rounded-lg shadow-md animate-fade-in-down">
                <i class="fas fa-user-secret fa-lg"></i>
                <span>شما در حال مشاهده به عنوان <span class="font-bold">${currentUser}</span> هستید.</span>
                <button id="exit-impersonation-btn" class="bg-white/20 hover:bg-white/30 text-white font-bold py-1 px-3 rounded-md text-sm border border-white/30">بازگشت به حساب ادمین</button>
            </div>
            `;
        }
    }


    window.lucide?.createIcons();
    
    setTimeout(() => {
        const mainContainer = document.querySelector('.landing-page-wrapper, #coach-dashboard-container, #user-dashboard-container, .admin-dashboard-container');
        if (mainContainer) {
            mainContainer.classList.add('opacity-100');
        }
    }, 50);
};

export const handleLoginSuccess = async (username: string) => {
    setCurrentUser(username);
    await idbSet("fitgympro_last_user", username);
    await renderApp();
};

export const handleLogout = async () => {
    // If admin is impersonating, logout should return them to admin panel
    const impersonatingAdmin = sessionStorage.getItem("impersonating_admin");
    if (impersonatingAdmin) {
        sessionStorage.removeItem("impersonating_admin");
        await handleLoginSuccess(impersonatingAdmin);
        return;
    }
    setCurrentUser(null);
    await idbDel("fitgympro_last_user");
    await renderApp();
};

const initTheme = () => {
    const docElement = document.documentElement;
    const themes = ['dark', 'lemon'];
    
    const updateThemeUI = (theme: string) => {
        const validTheme = themes.includes(theme) ? theme : 'dark';
        docElement.setAttribute("data-theme", validTheme);
        localStorage.setItem("fitgympro_theme", validTheme);
        
        document.querySelectorAll("#theme-switcher").forEach(switcher => {
            const glider = switcher.querySelector('#theme-glider') as HTMLElement;
            const lemonBtn = switcher.querySelector('[data-theme="lemon"]') as HTMLElement;
            const darkBtn = switcher.querySelector('[data-theme="dark"]') as HTMLElement;
            
            if (!glider || !lemonBtn || !darkBtn) return;
            
            // Timeout to allow browser to calculate layout after theme change
            setTimeout(() => {
                const activeBtn = validTheme === 'dark' ? darkBtn : lemonBtn;
                const inactiveBtn = validTheme === 'dark' ? lemonBtn : darkBtn;

                activeBtn.classList.add('active');
                inactiveBtn.classList.remove('active');
                
                glider.style.width = `${activeBtn.offsetWidth}px`;
                glider.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
            }, 50);

        });
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    };

    const currentTheme = localStorage.getItem("fitgympro_theme") || "dark";
    updateThemeUI(currentTheme);

    if (!themeListenerAttached) {
        document.body.addEventListener('click', (e) => {
            if (!(e.target instanceof HTMLElement)) return;

            const themeBtn = e.target.closest('.theme-option-btn');
            if (themeBtn && themeBtn.hasAttribute('data-theme')) {
                const newTheme = themeBtn.getAttribute('data-theme')!;
                updateThemeUI(newTheme);
                return;
            }
        });
        themeListenerAttached = true;
    }
};

const initSidebarToggle = () => {
    const overlay = document.getElementById('sidebar-overlay');

    const closeSidebar = () => {
        const sidebar = document.querySelector<HTMLElement>('aside.z-40');
        if (sidebar && overlay) {
            sidebar.classList.remove('!translate-x-0');
            overlay.classList.remove('is-visible');
        }
    };

    document.body.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const sidebarToggle = target.closest('#sidebar-toggle');
        const currentSidebar = document.querySelector<HTMLElement>('aside.z-40');

        if (sidebarToggle && currentSidebar) {
            if (currentSidebar.classList.contains('!translate-x-0')) {
                closeSidebar();
            } else {
                currentSidebar.classList.add('!translate-x-0');
                overlay?.classList.add('is-visible');
            }
        } else if (target.id === 'sidebar-overlay') {
            closeSidebar();
        } else if (target.closest('aside.z-40 nav > button')) {
            if (window.innerWidth < 1024) { // lg breakpoint
                closeSidebar();
            }
        }
    });
};

const initCommonListeners = () => {
    document.body.addEventListener('click', async e => {
        if (!(e.target instanceof HTMLElement)) return;
        const target = e.target as HTMLElement;
        
        // Handle password toggle
        const passwordToggle = target.closest('.password-toggle');
        if (passwordToggle) {
            const targetId = passwordToggle.getAttribute('data-target');
            if (targetId) {
                const passwordInput = document.getElementById(targetId) as HTMLInputElement;
                const icon = passwordToggle.querySelector('i');
                if (passwordInput && icon) {
                    if (passwordInput.type === 'password') {
                        passwordInput.type = 'text';
                        icon.setAttribute('data-lucide', 'eye-off');
                    } else {
                        passwordInput.type = 'password';
                        icon.setAttribute('data-lucide', 'eye');
                    }
                    window.lucide?.createIcons();
                }
            }
            return;
        }

        // Handle exit impersonation
        if (target.closest('#exit-impersonation-btn')) {
            await handleLogout();
            return;
        }
    });
};

export const initApp = async () => {
    const settings = await getSiteSettings();
    applySiteSettings(settings);
    await seedInitialUsers();
    await seedCMSData();
    await renderApp();
    initTheme();
    initSidebarToggle();
    initCommonListeners();
};
