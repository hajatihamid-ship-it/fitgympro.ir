
import { getUsers, getDiscounts, getActivityLog, saveUsers, saveUserData, addActivityLog, getUserData, getStorePlans, saveStorePlans, getExercisesDB, saveExercisesDB, getSupplementsDB, saveSupplementsDB, saveDiscounts, getSiteSettings, saveSiteSettings, getMagazineArticles, saveMagazineArticles } from '../services/storage';
import { formatPrice, timeAgo } from '../utils/helpers';
import { openModal, closeModal, showToast, applySiteSettings } from '../utils/dom';
import { getCurrentUser } from '../state';
import { sanitizeHTML } from '../utils/dom';

let activityModalChartInstance: any = null;
let coachAnalyticsSort = { key: 'rating', order: 'desc' };

const getStatusBadge = (status: string, role: string, coachStatus: string | null): string => {
    if (role === 'coach') {
        switch (coachStatus) {
            case 'verified':
                return '<span class="status-badge verified">تایید شده</span>';
            case 'pending':
                return '<span class="status-badge pending">در انتظار تایید</span>';
            case 'revoked':
                return '<span class="status-badge revoked">لغو همکاری</span>';
            default:
                return `<span class="status-badge unknown">${coachStatus || 'نامشخص'}</span>`;
        }
    }

    switch (status) {
        case 'active':
            return '<span class="status-badge verified">فعال</span>';
        case 'suspended':
            return '<span class="status-badge revoked">مسدود</span>';
        default:
            return `<span class="status-badge unknown">${status}</span>`;
    }
};

const renderAnalyticsPage = async () => {
    const pageContainer = document.getElementById('admin-analytics-page');
    if (!pageContainer) return;

    const allUsers = await getUsers();
    const coachesPromises = allUsers.filter((u: any) => u.role === 'coach' && u.coachStatus === 'verified').map(async (c: any) => {
        const data = await getUserData(c.username);
        return {
            username: c.username,
            name: data.step1?.clientName || c.username,
            students: data.students || 0,
            rating: data.performance?.rating || 0,
            nps: data.performance?.nps || 0,
            retentionRate: data.performance?.retentionRate || 0,
            avgProgramDeliveryHours: data.performance?.avgProgramDeliveryHours || 0
        };
    });
    
    const coaches = await Promise.all(coachesPromises);

    coaches.sort((a, b) => {
        const key = coachAnalyticsSort.key as keyof typeof a;
        if (a[key] < b[key]) return coachAnalyticsSort.order === 'asc' ? -1 : 1;
        if (a[key] > b[key]) return coachAnalyticsSort.order === 'asc' ? 1 : -1;
        return 0;
    });

    const renderSortIcon = (key: string) => {
        if (coachAnalyticsSort.key !== key) return `<i data-lucide="unfold-vertical" class="w-4 h-4 ml-1 text-text-secondary"></i>`;
        return coachAnalyticsSort.order === 'asc'
            ? `<i data-lucide="arrow-up" class="w-4 h-4 ml-1 text-accent"></i>`
            : `<i data-lucide="arrow-down" class="w-4 h-4 ml-1 text-accent"></i>`;
    };

    pageContainer.innerHTML = `
        <div class="card overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-right min-w-[700px]">
                    <thead>
                        <tr class="font-semibold">
                            <th class="p-4">نام مربی</th>
                            <th class="p-4 sortable-header cursor-pointer" data-sort-key="students">تعداد شاگردان ${renderSortIcon('students')}</th>
                            <th class="p-4 sortable-header cursor-pointer" data-sort-key="rating">امتیاز (از ۵) ${renderSortIcon('rating')}</th>
                            <th class="p-4 sortable-header cursor-pointer" data-sort-key="nps">شاخص NPS ${renderSortIcon('nps')}</th>
                            <th class="p-4 sortable-header cursor-pointer" data-sort-key="retentionRate">نرخ نگهداری (%) ${renderSortIcon('retentionRate')}</th>
                            <th class="p-4 sortable-header cursor-pointer" data-sort-key="avgProgramDeliveryHours">زمان تحویل برنامه (ساعت) ${renderSortIcon('avgProgramDeliveryHours')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${coaches.map(coach => `
                            <tr class="hover:bg-bg-tertiary transition-colors">
                                <td class="p-4 font-semibold">${coach.name}</td>
                                <td class="p-4 text-center">${coach.students}</td>
                                <td class="p-4 text-center">${coach.rating.toFixed(1)}</td>
                                <td class="p-4 text-center">${coach.nps}</td>
                                <td class="p-4 text-center">${coach.retentionRate}%</td>
                                <td class="p-4 text-center">${coach.avgProgramDeliveryHours}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    window.lucide?.createIcons();
};

const renderDiscountsAdminHtml = async () => {
    const discounts = await getDiscounts();
    return `
        <div class="flex justify-between items-center mb-4">
            <div>
                <h3 class="font-bold text-lg">مدیریت کدهای تخفیف</h3>
                <p class="text-text-secondary text-sm">کدهای تخفیf را برای کمپین‌های بازاریابی مدیریت کنید.</p>
            </div>
            <button data-action="add-discount" class="primary-button flex items-center gap-2"><i data-lucide="plus"></i> افزودن کد</button>
        </div>
        <div id="admin-discounts-list" class="space-y-2">
            ${Object.keys(discounts).length > 0 ? Object.entries(discounts).map(([code, details]: [string, any]) => `
                <div class="p-4 border border-border-primary rounded-lg flex items-center justify-between">
                   <div>
                     <p class="font-bold text-admin-accent-blue">${code}</p>
                     <p class="text-sm text-text-secondary">${details.type === 'percentage' ? `${details.value}% تخفیف` : `${formatPrice(details.value)} تخفیف`}</p>
                   </div>
                   <div class="flex items-center gap-2">
                        <button class="secondary-button !p-2" data-action="edit-discount" data-code="${code}"><i data-lucide="edit-3" class="w-4 h-4 pointer-events-none"></i></button>
                        <button class="secondary-button !p-2 text-red-accent" data-action="delete-discount" data-code="${code}"><i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button>
                   </div>
                </div>
            `).join('') : '<p class="text-text-secondary">هیچ کد تخفیفی ثبت نشده است.</p>'}
        </div>
    `;
};

const initCharts = async () => {
    const revenueCtx = document.getElementById('revenueChart') as HTMLCanvasElement;
    if (revenueCtx && window.Chart) {
        const existingChart = window.Chart.getChart(revenueCtx);
        if (existingChart) existingChart.destroy();

        const plans = await getStorePlans();
        const revenueData = {
            'basic-1m': [200000, 300000, 250000, 400000, 350000, 500000],
            'full-3m': [500000, 800000, 600000, 1000000, 900000, 1200000],
            'pro-6m': [400000, 600000, 500000, 800000, 700000, 1000000],
            'nutrition-1m': [100000, 200000, 150000, 300000, 250000, 300000],
        };

        const datasets = plans.map((plan: any) => ({
            label: plan.planName,
            data: revenueData[plan.planId as keyof typeof revenueData] || [],
            backgroundColor: plan.color,
        })).filter((ds: any) => ds.data.length > 0);

        new window.Chart(revenueCtx, {
            type: 'bar',
            data: {
                labels: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور'],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
            }
        });
    }

    const plansCtx = document.getElementById('plansChart') as HTMLCanvasElement;
    if (plansCtx && window.Chart) {
        const existingChart = window.Chart.getChart(plansCtx);
        if (existingChart) existingChart.destroy();
        new window.Chart(plansCtx, {
            type: 'doughnut',
            data: {
                labels: (await getStorePlans()).map((p: any) => p.planName),
                datasets: [{
                    label: 'فروش پلن',
                    data: [12, 19, 28, 21],
                    backgroundColor: ['#3b82f6', '#ec4899', '#f97316', '#10b981'],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
};

const renderUserRowsHtml = async () => {
    const users = await getUsers();
    const coaches = users.filter((u: any) => u.role === 'coach');

    const allUsersHtmlPromises = users.map(async (user: any) => {
        const userData = await getUserData(user.username);
        const name = userData.step1?.clientName || user.username;
        const avatar = userData.profile?.avatar;
        const avatarHtml = avatar
            ? `<img src="${avatar}" class="w-10 h-10 rounded-full object-cover" alt="${name}">`
            : `<div class="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center font-bold text-text-secondary">${name.charAt(0).toUpperCase()}</div>`;
        
        return `
        <tr class="hover:bg-bg-tertiary transition-colors">
            <td class="p-4">
                <div class="flex items-center gap-3">
                    ${avatarHtml}
                    <div>
                        <p class="font-semibold">${name}</p>
                        <p class="text-xs text-text-secondary">${user.username}</p>
                    </div>
                </div>
            </td>
            <td class="p-4">${user.email}</td>
            <td class="p-4">${user.role === 'admin' ? 'ادمین' : user.role === 'coach' ? 'مربی' : 'کاربر'}</td>
            <td class="p-4">${new Date(user.joinDate).toLocaleDateString('fa-IR')}</td>
            <td class="p-4">${getStatusBadge(user.status, user.role, user.coachStatus)}</td>
            <td class="p-4 flex items-center gap-2">
                <button data-action="view-activity" data-username="${user.username}" title="مشاهده فعالیت" class="secondary-button !p-2"><i data-lucide="eye" class="w-4 h-4 pointer-events-none"></i></button>
                <button data-action="edit-user" data-username="${user.username}" title="ویرایش کاربر" class="secondary-button !p-2"><i data-lucide="edit-3" class="w-4 h-4 pointer-events-none"></i></button>
                <button data-action="impersonate" data-username="${user.username}" title="ورود به حساب" class="secondary-button !p-2"><i data-lucide="log-in" class="w-4 h-4 pointer-events-none"></i></button>
                ${user.role !== 'admin' ? `
                    <button data-action="${user.status === 'active' ? 'suspend' : 'activate'}" data-username="${user.username}" title="${user.status === 'active' ? 'مسدود کردن' : 'فعال کردن'}" class="secondary-button !p-2">
                        <i data-lucide="${user.status === 'active' ? 'shield-off' : 'shield'}" class="w-4 h-4 pointer-events-none"></i>
                    </button>` : ''}
            </td>
        </tr>`;
    });
    const allUsersHtml = (await Promise.all(allUsersHtmlPromises)).join('');


    const coachesHtmlPromises = coaches.map(async (coach: any) => {
        const coachData = await getUserData(coach.username);
        const name = coachData.step1?.clientName || coach.username;
        const avatar = coachData.profile?.avatar;
        const avatarHtml = avatar
            ? `<img src="${avatar}" class="w-10 h-10 rounded-full object-cover" alt="${name}">`
            : `<div class="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center font-bold text-text-secondary">${name.charAt(0).toUpperCase()}</div>`;
            
        return `
        <tr class="hover:bg-bg-tertiary transition-colors">
            <td class="p-4">
                 <div class="flex items-center gap-3">
                    ${avatarHtml}
                    <div>
                        <p class="font-semibold">${name}</p>
                        <p class="text-xs text-text-secondary">${coach.username}</p>
                    </div>
                </div>
            </td>
            <td class="p-4">${coachData.students || 0}</td>
            <td class="p-4">${new Date(coach.joinDate).toLocaleDateString('fa-IR')}</td>
            <td class="p-4">${getStatusBadge(coach.status, coach.role, coach.coachStatus)}</td>
            <td class="p-4 flex items-center gap-2">
                 <button data-action="view-activity" data-username="${coach.username}" title="مشاهده فعالیت" class="secondary-button !p-2"><i data-lucide="eye" class="w-4 h-4 pointer-events-none"></i></button>
                <button data-action="edit-user" data-username="${coach.username}" title="ویرایش کاربر" class="secondary-button !p-2"><i data-lucide="edit-3" class="w-4 h-4 pointer-events-none"></i></button>
                <button data-action="impersonate" data-username="${coach.username}" title="ورود به حساب" class="secondary-button !p-2"><i data-lucide="log-in" class="w-4 h-4 pointer-events-none"></i></button>
                ${coach.coachStatus === 'pending' ? `
                    <button data-action="approve" data-username="${coach.username}" class="primary-button !py-1 !px-2 !text-xs">تایید</button>
                    <button data-action="reject" data-username="${coach.username}" class="secondary-button !py-1 !px-2 !text-xs !text-red-500">رد</button>` : ''}
                ${coach.coachStatus === 'verified' ? `<button data-action="revoke" data-username="${coach.username}" class="secondary-button !py-1 !px-2 !text-xs !text-red-500">لغو همکاری</button>` : ''}
                ${coach.coachStatus === 'revoked' ? `<button data-action="reapprove" data-username="${coach.username}" class="primary-button !py-1 !px-2 !text-xs">تایید مجدد</button>` : ''}
            </td>
        </tr>`;
    });
    const coachesHtml = (await Promise.all(coachesHtmlPromises)).join('');

    return { allUsersHtml, coachesHtml };
};

const refreshUserTables = async () => {
    const { allUsersHtml, coachesHtml } = await renderUserRowsHtml();
    const allUsersTbody = document.getElementById('all-users-tbody');
    const coachesTbody = document.getElementById('coaches-tbody');
    if (allUsersTbody) allUsersTbody.innerHTML = allUsersHtml;
    if (coachesTbody) coachesTbody.innerHTML = coachesHtml;
    window.lucide?.createIcons();
};

const renderAdminPlansListHtml = async () => {
    const plans = await getStorePlans();
    return plans.length > 0 ? plans.map((plan: any) => `
        <div class="p-4 border-l-4 rounded-lg flex items-center justify-between bg-bg-tertiary hover:bg-bg-tertiary/60 transition-colors" style="border-left-color: ${plan.color || 'var(--accent)'};">
           <div class="flex items-center gap-3">
                <span class="text-2xl">${plan.emoji || '📄'}</span>
                <div>
                    <p class="font-bold">${plan.planName}</p>
                    <p class="text-sm text-text-secondary">${formatPrice(plan.price)}</p>
                </div>
           </div>
           <div class="flex items-center gap-2">
                <button class="secondary-button !p-2" data-action="edit-plan" data-plan-id="${plan.planId}"><i data-lucide="edit-3" class="w-4 h-4 pointer-events-none"></i></button>
                <button class="secondary-button !p-2 text-red-accent" data-action="delete-plan" data-plan-id="${plan.planId}"><i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button>
           </div>
        </div>
    `).join('') : '<p class="text-text-secondary p-4 text-center">هنوز پلنی ایجاد نشده است.</p>';
};

const openUserActivityModal = async (username: string) => {
    const modal = document.getElementById('view-activity-modal');
    const body = document.getElementById('view-activity-modal-body');
    const title = document.getElementById('view-activity-modal-title');
    if (!modal || !body || !title) return;

    const userData = await getUserData(username);
    title.textContent = `نمای کلی فعالیت: ${username}`;

    const programHistory = userData.programHistory || [];
    if (programHistory.length === 0 && userData.step2) {
        programHistory.push({
            date: userData.joinDate || new Date().toISOString(),
            step2: userData.step2,
            supplements: userData.supplements || []
        });
    }

    const chatHistory = (userData.chatHistory || []).slice().reverse();

    body.innerHTML = `
        <div class="space-y-6">
            <div>
                <h4 class="font-bold text-lg mb-2 text-accent border-b-2 border-accent/30 pb-2">تاریخچه وزن</h4>
                <div class="h-64 card p-4"><canvas id="activity-modal-weight-chart"></canvas></div>
            </div>
            <div>
                <h4 class="font-bold text-lg mb-2 text-accent border-b-2 border-accent/30 pb-2">تاریخچه برنامه‌ها</h4>
                <div class="space-y-4 max-h-96 overflow-y-auto pr-2">
                    ${programHistory.length > 0 ? programHistory.map((p: any) => `
                        <details class="day-card card !shadow-none !border mb-2" open>
                            <summary class="font-bold cursor-pointer flex justify-between items-center p-3">
                                <span>برنامه تاریخ: ${new Date(p.date).toLocaleDateString('fa-IR')}</span>
                                <i data-lucide="chevron-down" class="details-arrow"></i>
                            </summary>
                            <div class="p-3 border-t border-border-primary text-sm">
                                ${(p.step2?.days || []).map((day: any) => `
                                    <div class="mb-2">
                                        <p class="font-semibold">${day.name}</p>
                                        <p class="text-xs text-text-secondary">${day.exercises.map((e:any) => e.name).join(' - ')}</p>
                                    </div>
                                `).join('')}
                            </div>
                        </details>
                    `).join('') : '<p class="text-text-secondary text-center p-4">هنوز برنامه‌ای برای این کاربر ثبت نشده است.</p>'}
                </div>
            </div>
            <div>
                <h4 class="font-bold text-lg mb-2 text-accent border-b-2 border-accent/30 pb-2">تاریخچه گفتگو</h4>
                <div class="space-y-2 text-sm max-h-96 overflow-y-auto pr-2 bg-bg-tertiary p-3 rounded-lg">
                    ${chatHistory.length > 0 ? chatHistory.map((msg: any) => `
                        <div class="p-2 rounded-lg ${msg.sender === 'user' ? 'bg-bg-secondary' : 'bg-green-500/10'}">
                            <p class="font-semibold text-xs">${msg.sender === 'user' ? username : 'مربی'} - <span class="text-text-secondary">${timeAgo(msg.timestamp)}</span></p>
                            <p>${sanitizeHTML(msg.message)}</p>
                        </div>
                    `).join('') : '<p class="text-text-secondary text-center p-4">گفتگویی یافت نشد.</p>'}
                </div>
            </div>
        </div>
    `;

    openModal(modal);
    window.lucide?.createIcons();

    const ctx = document.getElementById('activity-modal-weight-chart') as HTMLCanvasElement;
    if (activityModalChartInstance) activityModalChartInstance.destroy();
    if (ctx && window.Chart) {
        activityModalChartInstance = new window.Chart(ctx, {
            type: 'line',
            data: {
                labels: (userData.weightHistory || []).map((e: any) => new Date(e.date).toLocaleDateString('fa-IR')),
                datasets: [{
                    data: (userData.weightHistory || []).map((e: any) => e.weight),
                    borderColor: 'var(--accent)',
                    tension: 0.2,
                    pointRadius: 2,
                    backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
                    fill: true,
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
};

const renderCommissionsHtml = async () => {
    const allUsers = await getUsers();
    const coaches = allUsers.filter((u: any) => u.role === 'coach' && u.coachStatus === 'verified');
    const users = allUsers;
    const coachSales: Record<string, { totalSales: number, coachName: string }> = {};

    for (const coach of coaches) {
        const coachData = await getUserData(coach.username);
        coachSales[coach.username] = { totalSales: 0, coachName: coachData.step1?.clientName || coach.username };
    }

    for (const user of users) {
        const userData = await getUserData(user.username);
        const coachName = userData.step1?.coachName;
        if (coachName && coachSales[coachName]) {
            const userSales = (userData.subscriptions || []).reduce((sum: number, sub: any) => sum + sub.price, 0);
            coachSales[coachName].totalSales += userSales;
        }
    }
    
    const settings = await getSiteSettings();
    const commissionRate = (settings.financial.commissionRate || 0) / 100;

    return `
        <div class="card p-4">
            <div class="flex justify-between items-center mb-4">
                <div>
                    <h3 class="font-bold text-lg">کمیسیون مربیان</h3>
                    <p class="text-text-secondary text-sm">درآمد و کمیسیون قابل پرداخت به مربیان را مدیریت کنید.</p>
                </div>
                 <div class="bg-bg-tertiary p-2 rounded-lg">
                    <span class="text-sm font-semibold">نرخ کمیسیون سایت: <strong>${commissionRate * 100}%</strong></span>
                </div>
            </div>
            <div class="card overflow-hidden border border-border-primary">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-right min-w-[600px]">
                        <thead>
                            <tr class="font-semibold">
                                <th class="p-4">نام مربی</th>
                                <th class="p-4">کل فروش</th>
                                <th class="p-4">کمیسیون قابل پرداخت (سهم مربی)</th>
                                <th class="p-4">وضعیت</th>
                                <th class="p-4">عملیات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.keys(coachSales).length > 0 ? Object.entries(coachSales).map(([username, data]) => {
                                const sales = data.totalSales;
                                const coachShare = sales * (1 - commissionRate);
                                return `
                                    <tr class="hover:bg-bg-tertiary transition-colors">
                                        <td class="p-4 font-semibold">${data.coachName}</td>
                                        <td class="p-4">${formatPrice(sales)}</td>
                                        <td class="p-4 font-bold text-admin-accent-green">${formatPrice(coachShare)}</td>
                                        <td class="p-4">
                                            ${coachShare > 0 ? '<span class="status-badge pending">پرداخت نشده</span>' : '<span class="status-badge verified">تسویه شده</span>'}
                                        </td>
                                        <td class="p-4">
                                            <button class="primary-button !py-1 !px-2 !text-xs" ${coachShare === 0 ? 'disabled' : ''}>ثبت پرداخت</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('') : `<tr><td colspan="5" class="p-8 text-center text-text-secondary">هیچ مربی تایید شده‌ای برای محاسبه کمیسیون یافت نشد.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
};

const renderSettingsPageHTML = async () => {
    const settings = await getSiteSettings();

    return `
    <div class="flex items-center gap-2 border-b border-border-primary mb-6 flex-wrap">
        <button class="admin-tab-button active-tab" data-tab="branding">برندینگ</button>
        <button class="admin-tab-button" data-tab="contact">اطلاعات تماس</button>
        <button class="admin-tab-button" data-tab="features">ویژگی‌ها</button>
        <button class="admin-tab-button" data-tab="integrations">یکپارچه‌سازی و فروش</button>
        <button class="admin-tab-button" data-tab="content">مدیریت محتوا</button>
    </div>

    <form id="site-settings-form" class="space-y-6">
        <!-- Branding Tab -->
        <div id="branding-tab-content" class="admin-tab-content animate-fade-in">
            <div class="card p-6">
                <h3 class="font-bold text-lg mb-4">برندینگ و ظاهر</h3>
                <div class="space-y-4">
                    <div class="input-group">
                        <input type="text" id="setting-site-name" class="input-field w-full" value="${settings.siteName}" placeholder=" ">
                        <label for="setting-site-name" class="input-label">نام سایت</label>
                    </div>
                    <div class="input-group">
                        <input type="text" id="setting-logo-url" class="input-field w-full" value="${settings.logoUrl}" placeholder=" ">
                        <label for="setting-logo-url" class="input-label">URL لوگو (اختیاری)</label>
                    </div>
                    <div>
                        <label for="setting-accent-color" class="block text-sm font-semibold mb-2">رنگ اصلی (Accent)</label>
                        <div class="flex items-center gap-3">
                            <input type="color" id="setting-accent-color" class="p-1 h-10 w-14 block bg-bg-tertiary border border-border-primary cursor-pointer rounded-lg" value="${settings.accentColor}">
                            <span class="font-mono text-text-secondary">${settings.accentColor}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Contact Tab -->
        <div id="contact-tab-content" class="admin-tab-content hidden animate-fade-in">
             <div class="card p-6">
                <h3 class="font-bold text-lg mb-4">اطلاعات تماس و شبکه‌های اجتماعی</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-4">
                        <div class="input-group"><input type="email" id="setting-contact-email" class="input-field w-full" value="${settings.contactInfo.email}" placeholder=" "><label for="setting-contact-email" class="input-label">ایمیل پشتیبانی</label></div>
                        <div class="input-group"><input type="tel" id="setting-contact-phone" class="input-field w-full" value="${settings.contactInfo.phone}" placeholder=" "><label for="setting-contact-phone" class="input-label">شماره تماس</label></div>
                        <div class="input-group md:col-span-2"><input type="text" id="setting-contact-address" class="input-field w-full" value="${settings.contactInfo.address}" placeholder=" "><label for="setting-contact-address" class="input-label">آدرس</label></div>
                    </div>
                     <div class="space-y-4">
                        <div class="input-group"><input type="url" id="setting-social-instagram" class="input-field w-full" value="${settings.socialMedia.instagram}" placeholder=" "><label for="setting-social-instagram" class="input-label">لینک اینستاگرام</label></div>
                        <div class="input-group"><input type="url" id="setting-social-telegram" class="input-field w-full" value="${settings.socialMedia.telegram}" placeholder=" "><label for="setting-social-telegram" class="input-label">لینک تلگرام</label></div>
                        <div class="input-group"><input type="url" id="setting-social-youtube" class="input-field w-full" value="${settings.socialMedia.youtube}" placeholder=" "><label for="setting-social-youtube" class="input-label">لینک یوتیوب</label></div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Features Tab -->
        <div id="features-tab-content" class="admin-tab-content hidden animate-fade-in">
            <div class="card p-6">
                 <h3 class="font-bold text-lg mb-4">مدیریت ویژگی‌های سایت</h3>
                <div class="space-y-4">
                    <div class="flex items-center justify-between"><label for="setting-maintenance-mode" class="font-semibold cursor-pointer">حالت تعمیرات</label><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="setting-maintenance-mode" class="sr-only peer" ${settings.maintenanceMode ? 'checked' : ''}><div class="w-11 h-6 bg-bg-tertiary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div></label></div>
                    <div class="flex items-center justify-between"><label for="setting-allow-coach-reg" class="font-semibold cursor-pointer">اجازه ثبت‌نام مربی جدید</label><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="setting-allow-coach-reg" class="sr-only peer" ${settings.allowCoachRegistration ? 'checked' : ''}><div class="w-11 h-6 bg-bg-tertiary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div></label></div>
                </div>
            </div>
        </div>
        <!-- Integrations & Sales Tab -->
        <div id="integrations-tab-content" class="admin-tab-content hidden animate-fade-in">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="card p-6">
                    <h3 class="font-bold text-lg mb-4">درگاه‌های پرداخت</h3>
                    <div class="space-y-4">
                        <div class="input-group">
                            <input type="text" id="setting-gateway-zarinpal" class="input-field w-full" value="${settings.integrations.paymentGateways.zarinpal}" placeholder=" ">
                            <label for="setting-gateway-zarinpal" class="input-label">کد مرچنت زرین‌پال</label>
                        </div>
                        <div class="input-group">
                            <input type="text" id="setting-gateway-idpay" class="input-field w-full" value="${settings.integrations.paymentGateways.idpay}" placeholder=" ">
                            <label for="setting-gateway-idpay" class="input-label">API Key درگاه IDPay</label>
                        </div>
                        <div>
                            <label for="setting-active-gateway" class="block text-sm font-semibold mb-2">درگاه پرداخت فعال</label>
                            <select id="setting-active-gateway" class="input-field w-full">
                                <option value="zarinpal" ${settings.financial.activeGateway === 'zarinpal' ? 'selected' : ''}>زرین‌پال</option>
                                <option value="idpay" ${settings.financial.activeGateway === 'idpay' ? 'selected' : ''}>IDPay</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="space-y-6">
                    <div class="card p-6">
                        <h3 class="font-bold text-lg mb-4">سیستم همکاری در فروش</h3>
                        <div class="space-y-4">
                            <div class="flex items-center justify-between">
                                <label for="setting-affiliate-enabled" class="font-semibold cursor-pointer">فعال‌سازی سیستم</label>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="setting-affiliate-enabled" class="sr-only peer" ${settings.monetization.affiliateSystem.enabled ? 'checked' : ''}>
                                    <div class="w-11 h-6 bg-bg-tertiary rounded-full peer peer-checked:after:translate-x-full after:content[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                                </label>
                            </div>
                            <div class="input-group">
                                <input type="number" id="setting-affiliate-commission" class="input-field w-full" value="${settings.monetization.affiliateSystem.commissionRate}" placeholder=" " min="0" max="100">
                                <label for="setting-affiliate-commission" class="input-label">نرخ کمیسیون معرف (%)</label>
                            </div>
                        </div>
                    </div>
                    <div class="card p-6">
                        <h3 class="font-bold text-lg mb-4">مالی</h3>
                        <div class="input-group">
                            <input type="number" id="setting-commission-rate" class="input-field w-full" value="${settings.financial.commissionRate}" placeholder=" " min="0" max="100">
                            <label for="setting-commission-rate" class="input-label">نرخ کمیسیون سایت (%)</label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card p-6 mt-6">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h3 class="font-bold text-lg">وب‌هوک‌ها (Webhooks)</h3>
                        <p class="text-text-secondary text-sm">ارسال خودکار رویدادها به سرویس‌های دیگر.</p>
                    </div>
                    <button type="button" id="add-webhook-btn" class="primary-button flex items-center gap-2"><i data-lucide="plus"></i> افزودن وب‌هوک</button>
                </div>
                <div id="webhooks-list-container" class="space-y-2">
                    <!-- Webhooks will be rendered here by JS -->
                </div>
            </div>
        </div>
        <!-- Content Management Tab -->
        <div id="content-tab-content" class="admin-tab-content hidden animate-fade-in">
             <div class="card p-6">
                <h3 class="font-bold text-lg mb-4">مدیریت محتوای متنی</h3>
                <div class="space-y-4">
                     <div class="input-group"><textarea id="setting-content-terms" class="input-field w-full min-h-[150px]" placeholder=" ">${settings.content.terms}</textarea><label for="setting-content-terms" class="input-label">قوانین و مقررات</label></div>
                     <div class="input-group"><textarea id="setting-content-privacy" class="input-field w-full min-h-[150px]" placeholder=" ">${settings.content.privacyPolicy}</textarea><label for="setting-content-privacy" class="input-label">سیاست حریم خصوصی</label></div>
                </div>
            </div>
        </div>

        <div class="mt-6 text-right border-t border-border-primary pt-4">
            <button type="submit" class="primary-button">ذخیره تمام تغییرات</button>
        </div>
    </form>
    `;
};

const openArticleModal = async (articleId: string | null = null) => {
    const modal = document.getElementById('magazine-article-modal');
    const form = document.getElementById('magazine-article-form') as HTMLFormElement;
    const title = document.getElementById('magazine-article-modal-title');
    if (!modal || !form || !title) return;

    form.reset();
    form.removeAttribute('data-editing-id');

    if (articleId) {
        const articles = await getMagazineArticles();
        const article = articles.find(a => a.id === articleId);
        if (article) {
            title.textContent = 'ویرایش مقاله';
            form.setAttribute('data-editing-id', articleId);
            (form.elements.namedItem('title') as HTMLInputElement).value = article.title;
            (form.elements.namedItem('category') as HTMLInputElement).value = article.category;
            (form.elements.namedItem('imageUrl') as HTMLInputElement).value = article.imageUrl;
            (form.elements.namedItem('content') as HTMLTextAreaElement).value = article.content;
        }
    } else {
        title.textContent = 'افزودن مقاله جدید';
    }
    openModal(modal);
};

const renderMagazineAdminPage = async () => {
    const pageContainer = document.getElementById('admin-magazine-page');
    if (!pageContainer) return;

    const articles = await getMagazineArticles();

    pageContainer.innerHTML = `
        <div class="card p-4">
            <div class="flex justify-between items-center mb-4">
                <div>
                    <h3 class="font-bold text-lg">مدیریت مجله</h3>
                    <p class="text-text-secondary text-sm">مقالات آموزشی و خبری را برای کاربران منتشر کنید.</p>
                </div>
                <button data-action="add-article" class="primary-button flex items-center gap-2"><i data-lucide="plus"></i> افزودن مقاله</button>
            </div>
            <div id="admin-articles-list" class="space-y-3">
                ${articles.length > 0 ? articles.map((article: any) => `
                    <div class="p-4 border border-border-primary rounded-lg flex items-center justify-between gap-4">
                       <div class="flex-shrink-0">
                            <img src="${article.imageUrl || 'https://via.placeholder.com/100x80'}" alt="${article.title}" class="w-24 h-20 object-cover rounded-md">
                       </div>
                       <div class="flex-grow">
                         <p class="font-bold">${article.title}</p>
                         <p class="text-sm text-text-secondary">${article.category} - منتشر شده در: ${new Date(article.publishDate).toLocaleDateString('fa-IR')}</p>
                       </div>
                       <div class="flex items-center gap-2 flex-shrink-0">
                            <button class="secondary-button !p-2" data-action="edit-article" data-id="${article.id}"><i data-lucide="edit-3" class="w-4 h-4 pointer-events-none"></i></button>
                            <button class="secondary-button !p-2 text-red-accent" data-action="delete-article" data-id="${article.id}"><i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button>
                       </div>
                    </div>
                `).join('') : '<p class="text-text-secondary text-center p-8">هیچ مقاله‌ای ثبت نشده است.</p>'}
            </div>
        </div>
    `;
    window.lucide?.createIcons();
};

const openEditUserModal = async (username: string) => {
    const modal = document.getElementById('edit-user-modal');
    const body = document.getElementById('edit-user-modal-body');
    const title = document.getElementById('edit-user-modal-title');
    if (!modal || !body || !title) return;

    const users = await getUsers();
    const user = users.find(u => u.username === username);
    const userData = await getUserData(username);
    if (!user) return;

    title.textContent = `ویرایش کاربر: ${username}`;

    body.innerHTML = `
        <form id="edit-user-form" data-username="${username}" class="space-y-4">
            <div class="input-group">
                <input type="text" id="edit-user-name" class="input-field w-full" value="${userData.step1?.clientName || ''}" placeholder=" ">
                <label for="edit-user-name" class="input-label">نام نمایشی</label>
            </div>
            <div class="input-group">
                <input type="email" id="edit-user-email" class="input-field w-full" value="${user.email}" placeholder=" ">
                <label for="edit-user-email" class="input-label">ایمیل</label>
            </div>
            <div>
                <label for="edit-user-role" class="block text-sm font-semibold mb-2">نقش</label>
                <select id="edit-user-role" class="input-field w-full">
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>کاربر</option>
                    <option value="coach" ${user.role === 'coach' ? 'selected' : ''}>مربی</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>ادمین</option>
                </select>
            </div>
            <div id="coach-specific-fields" class="${user.role === 'coach' ? '' : 'hidden'}">
                <div class="mt-4">
                    <label for="edit-coach-tier" class="block text-sm font-semibold mb-2">سطح مربی</label>
                    <select id="edit-coach-tier" class="input-field w-full">
                        <option value="standard" ${user.coachTier === 'standard' ? 'selected' : ''}>استاندارد (Standard)</option>
                        <option value="pro" ${user.coachTier === 'pro' ? 'selected' : ''}>حرفه‌ای (Pro)</option>
                        <option value="head_coach" ${user.coachTier === 'head_coach' ? 'selected' : ''}>سرمربی (Head Coach)</option>
                    </select>
                </div>
            </div>
            <div class="pt-2">
                <button type="submit" class="primary-button w-full">ذخیره تغییرات</button>
            </div>
        </form>
    `;

    openModal(modal);

    const roleSelect = document.getElementById('edit-user-role');
    const coachFields = document.getElementById('coach-specific-fields');
    roleSelect?.addEventListener('change', (e) => {
        const selectedRole = (e.target as HTMLSelectElement).value;
        coachFields?.classList.toggle('hidden', selectedRole !== 'coach');
    });
};

const renderActivityLogPageHtml = async () => {
    const log = await getActivityLog();

    if (log.length === 0) {
        return `<div class="card p-8 text-center text-text-secondary">هیچ فعالیتی برای نمایش وجود ندارد.</div>`;
    }

    return `
        <div class="card p-4">
            <div class="space-y-3">
                ${log.map(entry => `
                    <div class="p-3 bg-bg-tertiary rounded-lg flex justify-between items-center text-sm">
                        <p>${sanitizeHTML(entry.message)}</p>
                        <span class="text-xs text-text-secondary flex-shrink-0">${timeAgo(entry.date)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};


export async function renderAdminDashboard() {
    const name = "Admin";
    const navItems = [
        { page: 'dashboard', icon: 'layout-dashboard', label: 'داشبورد' },
        { page: 'users', icon: 'users', label: 'مدیریت کاربران' },
        { page: 'coaches', icon: 'award', label: 'مدیریت مربیان' },
        { page: 'store', icon: 'shopping-cart', label: 'فروشگاه' },
        { page: 'analytics', icon: 'activity', label: 'آنالیتیکس' },
        { page: 'commissions', icon: 'dollar-sign', label: 'کمیسیون‌ها' },
        { page: 'cms', icon: 'database', label: 'مدیریت محتوا' },
        { page: 'magazine', icon: 'book-open-text', label: 'مجله' },
        { page: 'settings', icon: 'settings', label: 'تنظیمات سایت' },
        { page: 'activity-log', icon: 'history', label: 'گزارش فعالیت' }
    ];

    return `
    <div class="admin-dashboard-container lg:flex h-screen bg-bg-primary transition-opacity duration-500 opacity-0">
        <aside class="fixed inset-y-0 right-0 z-40 w-64 bg-bg-secondary p-4 flex flex-col flex-shrink-0 border-l border-border-primary transform translate-x-full transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0">
             <div class="flex items-center gap-3 p-2 mb-6">
                <i data-lucide="shield-check" class="w-8 h-8 text-accent"></i>
                <h1 class="text-xl font-bold">Admin Panel</h1>
            </div>
            <nav class="space-y-2 flex-grow">
                ${navItems.map(item => `
                    <button class="nav-link w-full flex items-center gap-3 py-3 rounded-lg text-md" data-page="${item.page}">
                        <i data-lucide="${item.icon}" class="w-5 h-5"></i>
                        <span>${item.label}</span>
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
                        <h1 id="admin-page-title" class="text-3xl font-bold">داشبورد</h1>
                    </div>
                </div>
                 <div class="flex items-center gap-3 bg-bg-secondary p-2 rounded-lg">
                    <div class="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-lg text-bg-secondary" style="background-color: var(--accent);">
                        ${name.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                        <p class="font-bold text-sm">${name}</p>
                        <p class="text-xs text-text-secondary">ادمین</p>
                    </div>
                </div>
            </header>
            
            <div id="admin-dashboard-page" class="page"></div>
            <div id="admin-users-page" class="page hidden"></div>
            <div id="admin-coaches-page" class="page hidden"></div>
            <div id="admin-store-page" class="page hidden"></div>
            <div id="admin-analytics-page" class="page hidden"></div>
            <div id="admin-commissions-page" class="page hidden"></div>
            <div id="admin-cms-page" class="page hidden"></div>
            <div id="admin-magazine-page" class="page hidden"></div>
            <div id="admin-settings-page" class="page hidden"></div>
            <div id="admin-activity-log-page" class="page hidden"></div>
        </main>
    </div>
    
    <!-- Modals for Admin Dashboard -->
    <div id="edit-user-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
        <div class="card w-full max-w-lg transform scale-95 transition-transform duration-300 relative">
             <div class="flex justify-between items-center p-4 border-b border-border-primary">
                <h2 id="edit-user-modal-title" class="font-bold text-xl">ویرایش کاربر</h2>
                <button class="close-modal-btn secondary-button !p-2 rounded-full"><i data-lucide="x"></i></button>
            </div>
            <div id="edit-user-modal-body" class="p-6"></div>
        </div>
    </div>
     <div id="view-activity-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
        <div class="card w-full max-w-3xl transform scale-95 transition-transform duration-300 relative max-h-[90vh] flex flex-col">
             <div class="flex justify-between items-center p-4 border-b border-border-primary flex-shrink-0">
                <h2 id="view-activity-modal-title" class="font-bold text-xl">نمای کلی فعالیت</h2>
                <button class="close-modal-btn secondary-button !p-2 rounded-full"><i data-lucide="x"></i></button>
            </div>
            <div id="view-activity-modal-body" class="p-6 overflow-y-auto"></div>
        </div>
    </div>
    <div id="webhook-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
        <form id="webhook-form" class="card w-full max-w-lg transform scale-95 transition-transform duration-300 relative">
             <div class="flex justify-between items-center p-4 border-b border-border-primary">
                <h2 id="webhook-modal-title" class="font-bold text-xl">افزودن وب‌هوک</h2>
                <button type="button" class="close-modal-btn secondary-button !p-2 rounded-full"><i data-lucide="x"></i></button>
            </div>
            <div class="p-6 space-y-4">
                <div class="input-group">
                    <input type="url" id="webhook-url" class="input-field w-full" placeholder=" " required>
                    <label for="webhook-url" class="input-label">URL مقصد</label>
                </div>
                <div>
                    <h4 class="font-semibold text-sm mb-2">رویدادها (Events)</h4>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <label class="custom-checkbox-label"><input type="checkbox" name="webhook_events" value="user.created" class="custom-checkbox"><span>ثبت نام کاربر جدید</span></label>
                        <label class="custom-checkbox-label"><input type="checkbox" name="webhook_events" value="plan.purchased" class="custom-checkbox"><span>خرید پلن جدید</span></label>
                        <label class="custom-checkbox-label"><input type="checkbox" name="webhook_events" value="program.sent" class="custom-checkbox"><span>ارسال برنامه توسط مربی</span></label>
                        <label class="custom-checkbox-label"><input type="checkbox" name="webhook_events" value="coach.approved" class="custom-checkbox"><span>تایید مربی جدید</span></label>
                    </div>
                </div>
            </div>
            <div class="p-4 border-t border-border-primary">
                <button type="submit" class="primary-button w-full">ذخیره وب‌هوک</button>
            </div>
        </form>
    </div>
    <div id="plan-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
        <form id="plan-form" class="card w-full max-w-2xl transform scale-95 transition-transform duration-300 relative max-h-[90vh] flex flex-col">
             <div class="flex justify-between items-center p-4 border-b border-border-primary flex-shrink-0">
                <h2 id="plan-modal-title" class="font-bold text-xl">افزودن پلن</h2>
                <button type="button" class="close-modal-btn secondary-button !p-2 rounded-full"><i data-lucide="x"></i></button>
            </div>
            <div class="p-6 space-y-4 overflow-y-auto">
                <div class="input-group"><input type="text" name="planName" class="input-field w-full" placeholder=" " required><label class="input-label">نام پلن</label></div>
                <div class="input-group"><input type="text" name="description" class="input-field w-full" placeholder=" " required><label class="input-label">توضیحات</label></div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="input-group"><input type="number" name="price" class="input-field w-full" placeholder=" " required><label class="input-label">قیمت (تومان)</label></div>
                    <div class="input-group"><input type="text" name="emoji" class="input-field w-full" placeholder=" "><label class="input-label">ایموجی</label></div>
                </div>
                <div class="input-group"><textarea name="features" class="input-field w-full min-h-[100px]" placeholder=" " required></textarea><label class="input-label">ویژگی‌ها (هر کدام در یک خط)</label></div>
                <div>
                    <label class="block text-sm font-semibold mb-2">رنگ پلن</label>
                    <input type="color" name="color" class="p-1 h-10 w-14 block bg-bg-tertiary border border-border-primary cursor-pointer rounded-lg" value="#3b82f6">
                </div>
                <div>
                    <h4 class="font-semibold text-sm mb-2">دسترسی‌ها</h4>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <label class="custom-checkbox-label"><input type="checkbox" name="access" value="workout_plan" class="custom-checkbox"><span>برنامه تمرینی</span></label>
                        <label class="custom-checkbox-label"><input type="checkbox" name="access" value="nutrition_plan" class="custom-checkbox"><span>برنامه غذایی</span></label>
                        <label class="custom-checkbox-label"><input type="checkbox" name="access" value="chat" class="custom-checkbox"><span>گفتگو با مربی</span></label>
                    </div>
                </div>
                <label class="custom-checkbox-label"><input type="checkbox" name="recommended" class="custom-checkbox"><span>این پلن پیشنهاد شود؟</span></label>
            </div>
            <div class="p-4 border-t border-border-primary flex-shrink-0"><button type="submit" class="primary-button w-full">ذخیره پلن</button></div>
        </form>
    </div>
    <div id="discount-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
        <form id="discount-form" class="card w-full max-w-md transform scale-95 transition-transform duration-300 relative">
             <div class="flex justify-between items-center p-4 border-b border-border-primary">
                <h2 id="discount-modal-title" class="font-bold text-xl">افزودن کد تخفیف</h2>
                <button type="button" class="close-modal-btn secondary-button !p-2 rounded-full"><i data-lucide="x"></i></button>
            </div>
            <div class="p-6 space-y-4">
                <div class="input-group"><input type="text" name="code" class="input-field w-full" placeholder=" " required><label class="input-label">کد تخفیف</label></div>
                <div>
                    <p class="text-sm font-semibold mb-2">نوع تخفیف</p>
                    <div class="grid grid-cols-2 gap-2">
                        <label class="option-card-label"><input type="radio" name="type" value="percentage" class="option-card-input" checked><span class="option-card-content">درصدی</span></label>
                        <label class="option-card-label"><input type="radio" name="type" value="fixed" class="option-card-input"><span class="option-card-content">مبلغ ثابت</span></label>
                    </div>
                </div>
                <div class="input-group"><input type="number" name="value" class="input-field w-full" placeholder=" " required><label class="input-label">مقدار (درصد یا تومان)</label></div>
            </div>
            <div class="p-4 border-t border-border-primary"><button type="submit" class="primary-button w-full">ذخیره کد</button></div>
        </form>
    </div>
     <div id="supplement-cms-modal" class="modal fixed inset-0 bg-black/60 z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
        <form id="supplement-cms-form" class="card w-full max-w-lg transform scale-95 transition-transform duration-300 relative">
             <div class="flex justify-between items-center p-4 border-b border-border-primary">
                <h2 id="supplement-cms-modal-title" class="font-bold text-xl">افزودن مکمل</h2>
                <button type="button" class="close-modal-btn secondary-button !p-2 rounded-full"><i data-lucide="x"></i></button>
            </div>
            <div class="p-6 space-y-4">
                <div class="input-group"><input type="text" name="name" class="input-field w-full" placeholder=" " required><label class="input-label">نام مکمل</label></div>
                <div class="input-group"><textarea name="dosageOptions" class="input-field w-full" placeholder=" " required></textarea><label class="input-label">گزینه‌های دوز (با کاما جدا کنید)</label></div>
                <div class="input-group"><textarea name="timingOptions" class="input-field w-full" placeholder=" " required></textarea><label class="input-label">گزینه‌های زمان مصرف (با کاما جدا کنید)</label></div>
                <div class="input-group"><textarea name="note" class="input-field w-full" placeholder=" "></textarea><label class="input-label">یادداشت کوتاه (اختیاری)</label></div>
            </div>
            <div class="p-4 border-t border-border-primary"><button type="submit" class="primary-button w-full">ذخیره مکمل</button></div>
        </form>
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
    `;
}

// FIX: Add and export initAdminDashboard to handle dashboard initialization and event listeners.
export async function initAdminDashboard(
    handleLogout: () => void, 
    handleLoginSuccess: (username: string) => void, 
    handleGoToHome: () => void
) {
    const mainContainer = document.querySelector('.admin-dashboard-container');
    if (!mainContainer) return;

    mainContainer.querySelector('#logout-btn')?.addEventListener('click', handleLogout);
    mainContainer.querySelector('#go-to-home-btn')?.addEventListener('click', handleGoToHome);

    const pageTitles: Record<string, string> = {
        'dashboard': 'داشبورد',
        'users': 'مدیریت کاربران',
        'coaches': 'مدیریت مربیان',
        'store': 'فروشگاه',
        'analytics': 'آنالیتیکس',
        'commissions': 'کمیسیون‌ها',
        'cms': 'مدیریت محتوا',
        'magazine': 'مجله',
        'settings': 'تنظیمات سایت',
        'activity-log': 'گزارش فعالیت'
    };

    const switchTab = async (page: string) => {
        mainContainer.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active-link'));
        mainContainer.querySelector(`.nav-link[data-page="${page}"]`)?.classList.add('active-link');

        mainContainer.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
        const pageContainer = document.getElementById(`admin-${page}-page`);
        if (pageContainer) {
            pageContainer.classList.remove('hidden');
            pageContainer.innerHTML = `<div class="flex justify-center items-center p-16"><div class="w-12 h-12 rounded-full animate-spin border-4 border-dashed border-accent border-t-transparent"></div></div>`;
        } else {
            return;
        }

        const titleEl = document.getElementById('admin-page-title');
        if (titleEl) {
            titleEl.textContent = pageTitles[page] || 'داشبورد';
        }

        switch (page) {
            case 'dashboard': {
                pageContainer.innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6"></div>
                    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <div class="lg:col-span-3 admin-chart-container h-96"><canvas id="revenueChart"></canvas></div>
                        <div class="lg:col-span-2 admin-chart-container h-96"><canvas id="plansChart"></canvas></div>
                    </div>
                `;
                const users = await getUsers();
                const pendingCoaches = users.filter((u: any) => u.role === 'coach' && u.coachStatus === 'pending');
                const statsCards = [
                    { title: 'کل کاربران', value: users.length, icon: 'users', color: 'admin-accent-blue' },
                    { title: 'کل مربیان', value: users.filter((u: any) => u.role === 'coach').length, icon: 'award', color: 'admin-accent-green' },
                    { title: 'مربیان در انتظار تایید', value: pendingCoaches.length, icon: 'user-check', color: 'admin-accent-orange' },
                    { title: 'فروش کل (ماه)', value: formatPrice(12500000), icon: 'trending-up', color: 'admin-accent-pink' }
                ];
                const statsContainer = pageContainer.querySelector('.grid');
                if (statsContainer) {
                    statsContainer.innerHTML = statsCards.map(stat => `
                        <div class="admin-kpi-card">
                            <div class="icon-container" style="background-color: var(--${stat.color});"><i data-lucide="${stat.icon}" class="w-6 h-6 text-white"></i></div>
                            <div><p class="font-bold text-2xl">${stat.value}</p><p class="text-sm text-text-secondary">${stat.title}</p></div>
                        </div>
                    `).join('');
                }
                 if (pendingCoaches.length > 0) {
                    const actionRequiredHtml = `
                    <div class="mt-6 card p-6 animate-fade-in lg:col-span-5">
                        <h3 class="font-bold text-lg mb-4 text-orange-500 flex items-center gap-2"><i data-lucide="alert-triangle"></i> نیازمند اقدام فوری</h3>
                        <div class="space-y-3">
                            ${pendingCoaches.map(coach => `
                                <div class="p-3 bg-bg-tertiary rounded-lg flex justify-between items-center">
                                    <div>
                                        <p class="font-semibold">${coach.username}</p>
                                        <p class="text-xs text-text-secondary">${new Date(coach.joinDate).toLocaleDateString('fa-IR')}</p>
                                    </div>
                                    <button class="primary-button !py-1 !px-2 !text-xs" data-action="go-to-coaches">مشاهده و بررسی</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    `;
                    pageContainer.querySelector(".lg\\:col-span-5")?.insertAdjacentHTML('afterend', actionRequiredHtml);
                }

                await initCharts();
                break;
            }
            case 'users': {
                pageContainer.innerHTML = `
                    <div class="card overflow-hidden">
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm text-right min-w-[900px]">
                                <thead><tr class="font-semibold"><th class="p-4">کاربر</th><th class="p-4">ایمیل</th><th class="p-4">نقش</th><th class="p-4">تاریخ عضویت</th><th class="p-4">وضعیت</th><th class="p-4">عملیات</th></tr></thead>
                                <tbody id="all-users-tbody"></tbody>
                            </table>
                        </div>
                    </div>
                `;
                await refreshUserTables();
                break;
            }
            case 'coaches': {
                pageContainer.innerHTML = `
                    <div class="card overflow-hidden">
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm text-right min-w-[700px]">
                                <thead><tr class="font-semibold"><th class="p-4">مربی</th><th class="p-4">تعداد شاگرد</th><th class="p-4">تاریخ عضویت</th><th class="p-4">وضعیت</th><th class="p-4">عملیات</th></tr></thead>
                                <tbody id="coaches-tbody"></tbody>
                            </table>
                        </div>
                    </div>
                `;
                await refreshUserTables();
                break;
            }
            case 'store': {
                 pageContainer.innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="card p-6">
                            <div class="flex justify-between items-center mb-4">
                                <div><h3 class="font-bold text-lg">مدیریت پلن‌ها</h3><p class="text-text-secondary text-sm">پلن‌های عضویت را اضافه، ویرایش یا حذف کنید.</p></div>
                                <button data-action="add-plan" class="primary-button flex items-center gap-2"><i data-lucide="plus"></i> افزودن پلن</button>
                            </div>
                            <div id="admin-plans-list" class="space-y-2">${await renderAdminPlansListHtml()}</div>
                        </div>
                         <div class="card p-6">${await renderDiscountsAdminHtml()}</div>
                    </div>
                 `;
                 break;
            }
            case 'analytics': await renderAnalyticsPage(); break;
            case 'commissions': pageContainer.innerHTML = await renderCommissionsHtml(); break;
            case 'cms': await renderCMSPage(); break;
            case 'magazine': await renderMagazineAdminPage(); break;
            case 'settings': pageContainer.innerHTML = await renderSettingsPageHTML(); break;
            case 'activity-log':
                pageContainer.innerHTML = await renderActivityLogPageHtml();
                break;
        }
        window.lucide?.createIcons();
    };

    mainContainer.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            const page = (link as HTMLElement).dataset.page;
            if (page) switchTab(page);
        });
    });

    mainContainer.addEventListener('click', async e => {
        const target = e.target as HTMLElement;
        const actionBtn = target.closest<HTMLButtonElement>('[data-action]');
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            const username = actionBtn.dataset.username;
            switch (action) {
                case 'go-to-coaches':
                    (mainContainer.querySelector('.nav-link[data-page="coaches"]') as HTMLElement)?.click();
                    break;
                case 'impersonate':
                    if (username) {
                        const currentUser = getCurrentUser();
                        sessionStorage.setItem("impersonating_admin", currentUser || 'admin');
                        await handleLoginSuccess(username);
                    }
                    break;
                case 'suspend': case 'activate': case 'approve': case 'reject': case 'revoke': case 'reapprove':
                    if (username) {
                        const users = await getUsers();
                        const user = users.find(u => u.username === username);
                        if (user) {
                            if (action === 'suspend') user.status = 'suspended';
                            if (action === 'activate') user.status = 'active';
                            if (action === 'approve') user.coachStatus = 'verified';
                            if (action === 'reject') user.coachStatus = 'revoked';
                            if (action === 'revoke') user.coachStatus = 'revoked';
                            if (action === 'reapprove') user.coachStatus = 'verified';
                            await saveUsers(users);
                            await addActivityLog(`Admin action '${action}' on user ${username}.`);
                            showToast('وضعیت کاربر بروزرسانی شد', 'success');
                            await refreshUserTables();
                        }
                    }
                    break;
                case 'view-activity': if (username) await openUserActivityModal(username); break;
                case 'edit-user': if (username) await openEditUserModal(username); break;
                case 'add-article': await openArticleModal(); break;
                case 'edit-article': {
                    const articleId = actionBtn.dataset.id;
                    if (articleId) await openArticleModal(articleId);
                    break;
                }
                case 'delete-article': {
                    const articleId = actionBtn.dataset.id;
                    if (articleId && confirm('آیا از حذف این مقاله مطمئن هستید؟')) {
                        let articles = await getMagazineArticles();
                        await saveMagazineArticles(articles.filter(a => a.id !== articleId));
                        showToast('مقاله حذف شد.', 'success');
                        await renderMagazineAdminPage();
                    }
                    break;
                }
                case 'add-plan': openPlanModal(); break;
                case 'edit-plan': {
                    const planId = actionBtn.dataset.planId;
                    if(planId) openPlanModal(planId);
                    break;
                }
                case 'delete-plan': {
                    const planId = actionBtn.dataset.planId;
                    if(planId && confirm('آیا از حذف این پلن مطمئن هستید؟')) {
                        const plans = await getStorePlans();
                        await saveStorePlans(plans.filter(p => p.planId !== planId));
                        showToast('پلن حذف شد', 'success');
                        document.getElementById('admin-plans-list')!.innerHTML = await renderAdminPlansListHtml();
                        window.lucide?.createIcons();
                    }
                    break;
                }
                 case 'add-discount': openDiscountModal(); break;
                 case 'edit-discount': {
                     const code = actionBtn.dataset.code;
                     if (code) openDiscountModal(code);
                     break;
                 }
                 case 'delete-discount': {
                     const code = actionBtn.dataset.code;
                     if (code && confirm(`آیا از حذف کد تخفیف "${code}" مطمئن هستید؟`)) {
                         const discounts = await getDiscounts();
                         delete discounts[code];
                         await saveDiscounts(discounts);
                         showToast('کد تخفیف حذف شد', 'success');
                         document.querySelector('.card .p-6:last-child')!.innerHTML = await renderDiscountsAdminHtml();
                         window.lucide?.createIcons();
                     }
                     break;
                 }
                 case 'add-muscle-group': case 'add-exercise': case 'rename-muscle-group': case 'rename-exercise': case 'delete-muscle-group': case 'delete-exercise':
                 case 'add-supplement-category': case 'add-supplement': case 'rename-supplement-category': case 'edit-supplement': case 'delete-supplement-category': case 'delete-supplement':
                    await handleCMSAction(action, actionBtn.dataset);
                    break;
            }
        }
        const modalCloser = target.closest('.close-modal-btn') || (target.classList.contains('modal') ? target : null);
        if (modalCloser) closeModal(modalCloser.closest('.modal'));

        const sortableHeader = target.closest('.sortable-header');
        if (sortableHeader) {
            const key = (sortableHeader as HTMLElement).dataset.sortKey;
            if (key) {
                if (coachAnalyticsSort.key === key) {
                    coachAnalyticsSort.order = coachAnalyticsSort.order === 'asc' ? 'desc' : 'asc';
                } else {
                    coachAnalyticsSort.key = key;
                    coachAnalyticsSort.order = 'desc';
                }
                await renderAnalyticsPage();
            }
        }
        
        const settingsTab = target.closest('#admin-settings-page .admin-tab-button');
        if (settingsTab) {
            const tabId = settingsTab.getAttribute('data-tab');
            if (tabId) {
                mainContainer.querySelectorAll('#admin-settings-page .admin-tab-button').forEach(btn => btn.classList.remove('active-tab'));
                settingsTab.classList.add('active-tab');
                mainContainer.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
                document.getElementById(`${tabId}-tab-content`)?.classList.remove('hidden');
            }
        }
        
        const cmsTab = target.closest('#admin-cms-page .admin-tab-button');
        if (cmsTab) {
            const tabId = cmsTab.getAttribute('data-tab');
            if (tabId) {
                mainContainer.querySelectorAll('#admin-cms-page .admin-tab-button').forEach(btn => btn.classList.remove('active-tab'));
                cmsTab.classList.add('active-tab');
                mainContainer.querySelectorAll('#admin-cms-page .admin-tab-content').forEach(c => c.classList.add('hidden'));
                document.getElementById(`${tabId}-cms-content`)?.classList.remove('hidden');
            }
        }
    });
    
    mainContainer.addEventListener('submit', async (e: Event) => {
        const form = e.target as HTMLFormElement;
        
        if (form.id === 'edit-user-form') {
            e.preventDefault();
            const username = form.dataset.username;
            if (!username) return;

            const name = (form.querySelector('#edit-user-name') as HTMLInputElement).value;
            const email = (form.querySelector('#edit-user-email') as HTMLInputElement).value;
            const role = (form.querySelector('#edit-user-role') as HTMLSelectElement).value;

            const users = await getUsers();
            const userIndex = users.findIndex(u => u.username === username);
            const userData = await getUserData(username);

            if (userIndex > -1) {
                users[userIndex].email = email;
                users[userIndex].role = role;
                if(role === 'coach') {
                    const tier = (form.querySelector('#edit-coach-tier') as HTMLSelectElement).value;
                    users[userIndex].coachTier = tier;
                } else {
                    delete users[userIndex].coachTier;
                }

                if (!userData.step1) userData.step1 = {};
                userData.step1.clientName = name;

                await saveUsers(users);
                await saveUserData(username, userData);
                await addActivityLog(`Admin updated profile for ${username}.`);
                showToast('اطلاعات کاربر به‌روزرسانی شد.', 'success');
                closeModal(document.getElementById('edit-user-modal'));
                await refreshUserTables();
            }
            return;
        }

        if (form.id === 'magazine-article-form') {
             e.preventDefault();
            const formData = new FormData(form);
            const editingId = form.dataset.editingId;
            const articleData = {
                id: editingId || `article_${Date.now()}`,
                title: formData.get('title') as string,
                category: formData.get('category') as string,
                imageUrl: formData.get('imageUrl') as string,
                content: formData.get('content') as string,
                publishDate: new Date().toISOString(),
                author: 'admin10186'
            };
            let articles = await getMagazineArticles();
            if (editingId) {
                const index = articles.findIndex(a => a.id === editingId);
                if (index > -1) articles[index] = { ...articles[index], ...articleData };
            } else {
                articles.unshift(articleData);
            }
            await saveMagazineArticles(articles);
            showToast(`مقاله با موفقیت ${editingId ? 'ویرایش' : 'ذخیره'} شد.`, 'success');
            closeModal(document.getElementById('magazine-article-modal'));
            await renderMagazineAdminPage();
        }

        if (form.id === 'plan-form') {
            await handlePlanFormSubmit(e)
        };
        if (form.id === 'discount-form') {
            await handleDiscountFormSubmit(e)
        };
        if (form.id === 'supplement-cms-form') {
            await handleSupplementFormSubmit(e)
        };
    });
    

    await switchTab('dashboard');
}

const openPlanModal = async (planId: string | null = null) => {
    const modal = document.getElementById('plan-modal');
    const form = document.getElementById('plan-form') as HTMLFormElement;
    const title = document.getElementById('plan-modal-title');
    if (!modal || !form || !title) return;

    form.reset();
    form.removeAttribute('data-editing-id');

    if (planId) {
        const plans = await getStorePlans();
        const plan = plans.find(p => p.planId === planId);
        if(plan) {
            title.textContent = 'ویرایش پلن';
            form.setAttribute('data-editing-id', planId);
            (form.elements.namedItem('planName') as HTMLInputElement).value = plan.planName;
            (form.elements.namedItem('description') as HTMLInputElement).value = plan.description;
            (form.elements.namedItem('price') as HTMLInputElement).value = plan.price;
            (form.elements.namedItem('emoji') as HTMLInputElement).value = plan.emoji;
            (form.elements.namedItem('features') as HTMLTextAreaElement).value = (plan.features || []).join('\n');
            (form.elements.namedItem('color') as HTMLInputElement).value = plan.color;
            (form.elements.namedItem('recommended') as HTMLInputElement).checked = plan.recommended;
            (plan.access || []).forEach((p: string) => {
                const checkbox = form.querySelector(`input[name="access"][value="${p}"]`) as HTMLInputElement;
                if(checkbox) checkbox.checked = true;
            });
        }
    } else {
        title.textContent = 'افزودن پلن جدید';
    }

    openModal(modal);
};

const handlePlanFormSubmit = async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const editingId = form.dataset.editingId;
    
    const formData = new FormData(form);
    const access = formData.getAll('access') as string[];
    
    const planData: any = {
        planId: editingId || `plan_${Date.now()}`,
        planName: formData.get('planName'),
        description: formData.get('description'),
        price: Number(formData.get('price')),
        emoji: formData.get('emoji'),
        features: (formData.get('features') as string).split('\n').filter(Boolean),
        color: formData.get('color'),
        recommended: (formData.get('recommended') as any) === 'on',
        access: access
    };

    const plans = await getStorePlans();
    if(editingId) {
        const index = plans.findIndex(p => p.planId === editingId);
        if(index > -1) plans[index] = planData;
    } else {
        plans.push(planData);
    }

    await saveStorePlans(plans);
    showToast(`پلن با موفقیت ${editingId ? 'ویرایش' : 'ذخیره'} شد.`, 'success');
    closeModal(document.getElementById('plan-modal'));
    document.getElementById('admin-plans-list')!.innerHTML = await renderAdminPlansListHtml();
    window.lucide?.createIcons();
};

const openDiscountModal = async (code: string | null = null) => {
    const modal = document.getElementById('discount-modal');
    const form = document.getElementById('discount-form') as HTMLFormElement;
    const title = document.getElementById('discount-modal-title');
    if (!modal || !form || !title) return;

    form.reset();
    form.removeAttribute('data-editing-code');
    (form.elements.namedItem('code') as HTMLInputElement).readOnly = false;

    if(code) {
        const discounts = await getDiscounts();
        const discount = discounts[code];
        if(discount) {
            title.textContent = 'ویرایش کد تخفیف';
            form.setAttribute('data-editing-code', code);
            const codeInput = (form.elements.namedItem('code') as HTMLInputElement);
            codeInput.value = code;
            codeInput.readOnly = true;
            (form.elements.namedItem('value') as HTMLInputElement).value = String(discount.value);
            const typeRadio = form.querySelector(`input[name="type"][value="${discount.type}"]`) as HTMLInputElement;
            if(typeRadio) typeRadio.checked = true;
        }
    } else {
        title.textContent = 'افزودن کد تخفیف';
    }
    openModal(modal);
};

const handleDiscountFormSubmit = async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const code = (form.elements.namedItem('code') as HTMLInputElement).value.toUpperCase();
    const type = (form.querySelector('input[name="type"]:checked') as HTMLInputElement).value;
    const value = Number((form.elements.namedItem('value') as HTMLInputElement).value);

    if(!code || isNaN(value) || value <= 0) {
        showToast('لطفا تمام فیلدها را به درستی پر کنید.', 'error');
        return;
    }

    const discounts = await getDiscounts();
    discounts[code] = { type, value };
    await saveDiscounts(discounts);

    showToast('کد تخفیف ذخیره شد.', 'success');
    closeModal(document.getElementById('discount-modal'));
    document.querySelector('.card .p-6:last-child')!.innerHTML = await renderDiscountsAdminHtml();
    window.lucide?.createIcons();
};

const openSupplementModal = async (category: string, supplementName: string | null = null) => {
    const modal = document.getElementById('supplement-cms-modal');
    const form = document.getElementById('supplement-cms-form') as HTMLFormElement;
    const title = document.getElementById('supplement-cms-modal-title');
    if (!modal || !form || !title) return;

    form.reset();
    form.dataset.category = category;
    form.removeAttribute('data-editing-name');

    if (supplementName) {
        title.textContent = "ویرایش مکمل";
        form.dataset.editingName = supplementName;
        const db = await getSupplementsDB();
        const supplement = db[category]?.find(s => s.name === supplementName);
        if (supplement) {
            (form.elements.namedItem('name') as HTMLInputElement).value = supplement.name;
            (form.elements.namedItem('dosageOptions') as HTMLTextAreaElement).value = supplement.dosageOptions.join(', ');
            (form.elements.namedItem('timingOptions') as HTMLTextAreaElement).value = supplement.timingOptions.join(', ');
            (form.elements.namedItem('note') as HTMLTextAreaElement).value = supplement.note || '';
        }
    } else {
        title.textContent = "افزودن مکمل";
    }

    openModal(modal);
};

const handleSupplementFormSubmit = async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const category = form.dataset.category;
    const editingName = form.dataset.editingName;
    if (!category) return;
    
    const formData = new FormData(form);
    const supData = {
        name: formData.get('name') as string,
        dosageOptions: (formData.get('dosageOptions') as string).split(',').map(s => s.trim()).filter(Boolean),
        timingOptions: (formData.get('timingOptions') as string).split(',').map(s => s.trim()).filter(Boolean),
        note: formData.get('note') as string,
    };

    if (!supData.name || supData.dosageOptions.length === 0 || supData.timingOptions.length === 0) {
        showToast('لطفا تمام فیلدهای لازم را پر کنید.', 'error');
        return;
    }

    const db = await getSupplementsDB();
    if(editingName) {
        const index = db[category].findIndex(s => s.name === editingName);
        if (index > -1) db[category][index] = supData;
    } else {
        db[category].push(supData);
    }

    await saveSupplementsDB(db);
    showToast('مکمل ذخیره شد.', 'success');
    closeModal(document.getElementById('supplement-cms-modal'));
    await renderCMSPage();
};

const handleCMSAction = async (action: string, dataset: DOMStringMap) => {
    let db;
    const { group, exercise, category, supplement } = dataset;
    
    switch (action) {
        // Exercises
        case 'add-muscle-group':
            const newGroup = prompt("نام گروه عضلانی جدید را وارد کنید:");
            if (newGroup) {
                db = await getExercisesDB();
                if (!db[newGroup]) {
                    db[newGroup] = [];
                    await saveExercisesDB(db);
                }
            }
            break;
        case 'add-exercise':
            if (group) {
                const newEx = prompt(`نام حرکت جدید برای گروه "${group}" را وارد کنید:`);
                if (newEx) {
                    db = await getExercisesDB();
                    db[group].push(newEx);
                    await saveExercisesDB(db);
                }
            }
            break;
        // ... other exercise cases ...

        // Supplements
        case 'add-supplement-category':
            const newCat = prompt("نام دسته بندی جدید مکمل را وارد کنید:");
            if (newCat) {
                db = await getSupplementsDB();
                if (!db[newCat]) {
                    db[newCat] = [];
                    await saveSupplementsDB(db);
                }
            }
            break;
        case 'add-supplement': if(category) await openSupplementModal(category); return;
        case 'edit-supplement': if(category && supplement) await openSupplementModal(category, supplement); return;
    }

    await renderCMSPage(); // Re-render after action
};

const renderCMSPage = async () => {
    const pageContainer = document.getElementById('admin-cms-page');
    if(!pageContainer) return;
    
    pageContainer.innerHTML = `
        <div class="flex items-center gap-2 border-b border-border-primary mb-6 flex-wrap">
            <button class="admin-tab-button active-tab" data-tab="exercises">تمرینات</button>
            <button class="admin-tab-button" data-tab="supplements">مکمل‌ها</button>
        </div>
        <div id="exercises-cms-content" class="admin-tab-content">${await renderExercisesAdmin()}</div>
        <div id="supplements-cms-content" class="admin-tab-content hidden">${await renderSupplementsAdmin()}</div>
    `;
    window.lucide?.createIcons();
};

const renderExercisesAdmin = async () => {
    const db = await getExercisesDB();
    return `
        <div class="card p-4">
            <div class="flex justify-between items-center mb-4">
                <h3 class="font-bold text-lg">پایگاه داده تمرینات</h3>
                <button data-action="add-muscle-group" class="primary-button !text-sm">افزودن گروه عضلانی</button>
            </div>
            <div class="space-y-3">
            ${Object.keys(db).map(group => `
                <details class="bg-bg-tertiary rounded-lg">
                    <summary class="p-3 font-semibold cursor-pointer flex justify-between items-center">
                        <span>${group}</span>
                        <div class="flex items-center gap-2">
                             <button class="secondary-button !p-1.5 !rounded-full" data-action="add-exercise" data-group="${group}"><i data-lucide="plus" class="w-4 h-4 pointer-events-none"></i></button>
                             <button class="secondary-button !p-1.5 !rounded-full" data-action="rename-muscle-group" data-group="${group}"><i data-lucide="edit-3" class="w-4 h-4 pointer-events-none"></i></button>
                             <button class="secondary-button !p-1.5 !rounded-full text-red-accent" data-action="delete-muscle-group" data-group="${group}"><i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button>
                        </div>
                    </summary>
                    <div class="p-3 border-t border-border-primary bg-bg-secondary rounded-b-lg">
                        ${db[group].length > 0 ? db[group].map(ex => `
                        <div class="flex justify-between items-center p-2 hover:bg-bg-tertiary rounded-md">
                            <span class="text-sm">${ex}</span>
                            <div class="flex items-center gap-1">
                                <button class="secondary-button !p-1 !rounded-full" data-action="rename-exercise" data-group="${group}" data-exercise="${ex}"><i data-lucide="edit-3" class="w-3 h-3 pointer-events-none"></i></button>
                                <button class="secondary-button !p-1 !rounded-full text-red-accent" data-action="delete-exercise" data-group="${group}" data-exercise="${ex}"><i data-lucide="trash-2" class="w-3 h-3 pointer-events-none"></i></button>
                            </div>
                        </div>`).join('') : '<p class="text-xs text-center text-text-secondary">حرکتی ثبت نشده</p>'}
                    </div>
                </details>
            `).join('')}
            </div>
        </div>
    `;
};

const renderSupplementsAdmin = async () => {
    const db = await getSupplementsDB();
    return `
         <div class="card p-4">
            <div class="flex justify-between items-center mb-4">
                <h3 class="font-bold text-lg">پایگاه داده مکمل‌ها</h3>
                <button data-action="add-supplement-category" class="primary-button !text-sm">افزودن دسته بندی</button>
            </div>
            <div class="space-y-3">
            ${Object.keys(db).map(cat => `
                <details class="bg-bg-tertiary rounded-lg">
                    <summary class="p-3 font-semibold cursor-pointer flex justify-between items-center">
                        <span>${cat}</span>
                        <div class="flex items-center gap-2">
                             <button class="secondary-button !p-1.5 !rounded-full" data-action="add-supplement" data-category="${cat}"><i data-lucide="plus" class="w-4 h-4 pointer-events-none"></i></button>
                             <button class="secondary-button !p-1.5 !rounded-full" data-action="rename-supplement-category" data-category="${cat}"><i data-lucide="edit-3" class="w-4 h-4 pointer-events-none"></i></button>
                             <button class="secondary-button !p-1.5 !rounded-full text-red-accent" data-action="delete-supplement-category" data-category="${cat}"><i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button>
                        </div>
                    </summary>
                    <div class="p-3 border-t border-border-primary bg-bg-secondary rounded-b-lg">
                        ${db[cat].length > 0 ? db[cat].map(sup => `
                        <div class="flex justify-between items-center p-2 hover:bg-bg-tertiary rounded-md">
                            <span class="text-sm font-semibold">${sup.name}</span>
                            <div class="flex items-center gap-1">
                                <button class="secondary-button !p-1 !rounded-full" data-action="edit-supplement" data-category="${cat}" data-supplement="${sup.name}"><i data-lucide="edit-3" class="w-3 h-3 pointer-events-none"></i></button>
                                <button class="secondary-button !p-1 !rounded-full text-red-accent" data-action="delete-supplement" data-category="${cat}" data-supplement="${sup.name}"><i data-lucide="trash-2" class="w-3 h-3 pointer-events-none"></i></button>
                            </div>
                        </div>`).join('') : '<p class="text-xs text-center text-text-secondary">مکملی ثبت نشده</p>'}
                    </div>
                </details>
            `).join('')}
            </div>
        </div>
    `;
};
