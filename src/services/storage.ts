// This file centralizes all static data and configuration for the application.
import { showToast } from "../utils/dom";
import { exerciseDB as initialExerciseDB, supplementsDB as initialSupplementsDB } from '../config';

// --- IndexedDB Helper Functions (inlined for simplicity) ---
const DB_NAME = 'fitgympro-db-kv';
const DB_VERSION = 1;
const STORE_NAME = 'keyValueStore';
let db: IDBDatabase;

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = () => {
            const upgradedDb = request.result;
            if (!upgradedDb.objectStoreNames.contains(STORE_NAME)) {
                upgradedDb.createObjectStore(STORE_NAME);
            }
        };
    });
}

async function withStore<T>(type: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, type);
        const store = transaction.objectStore(STORE_NAME);
        
        let req: IDBRequest<any> | undefined;
        const result = callback(store);
        if (result instanceof IDBRequest) {
            req = result;
        }

        transaction.oncomplete = () => {
            resolve(req ? req.result : undefined);
        };
        transaction.onerror = () => {
            console.error('Transaction Error:', transaction.error);
            reject(transaction.error);
        };
    });
}

// FIX: Export idb helpers for use in other modules
export const idbGet = <T>(key: IDBValidKey): Promise<T | undefined> => withStore('readonly', store => store.get(key));
// FIX: Correct return type to Promise<void> to match usage. The result of a put operation is often not needed.
export const idbSet = (key: IDBValidKey, value: any): Promise<void> => withStore('readwrite', store => store.put(value, key)).then(() => {});
export const idbDel = (key: IDBValidKey): Promise<void> => withStore('readwrite', store => store.delete(key));

// --- Users ---
export const getUsers = async (): Promise<any[]> => {
    const users = await idbGet<any[]>("fitgympro_users");
    return users || [];
};

export const saveUsers = async (users: any[]) => {
    try {
        await idbSet("fitgympro_users", users);
    } catch (t) {
        console.error("Error saving users to IndexedDB:", t);
        showToast("خطا در ذخیره‌سازی اطلاعات کاربران", "error");
    }
};

// --- User Data ---
export const getUserData = async (username: string): Promise<any> => {
    const data = await idbGet(`fitgympro_data_${username}`);
    return data || {};
};

export const saveUserData = async (username: string, data: any) => {
    try {
        await idbSet(`fitgympro_data_${username}`, data);
    } catch (s) {
        console.error(`Error saving data for user ${username} to IndexedDB:`, s);
        showToast("خطا در ذخیره‌سازی اطلاعات برنامه", "error");
    }
};

// --- Activity Log ---
export const getActivityLog = async (): Promise<any[]> => {
    const log = await idbGet<any[]>("fitgympro_activity_log");
    return log || [];
};

export const addActivityLog = async (message: string) => {
    try {
        let log = await getActivityLog();
        log.unshift({
            message: message,
            date: new Date().toISOString()
        });
        if (log.length > 50) {
            log = log.slice(0, 50);
        }
        await idbSet("fitgympro_activity_log", log);
    } catch (t) {
        console.error("Error saving activity log to IndexedDB:", t);
    }
};

// --- Templates ---
export const getTemplates = async (): Promise<any> => {
    const templates = await idbGet("fitgympro_templates");
    return templates || {};
};

const saveTemplates = async (templates: any) => {
    try {
        await idbSet("fitgympro_templates", templates);
    } catch (t) {
        console.error("Error saving templates to IndexedDB:", t);
        showToast("خطا در ذخیره‌سازی الگوها", "error");
    }
};

export const saveTemplate = async (name: string, data: any) => {
    const templates = await getTemplates();
    templates[name] = data;
    await saveTemplates(templates);
};

export const deleteTemplate = async (name: string) => {
    const templates = await getTemplates();
    delete templates[name];
    await saveTemplates(templates);
};


// --- CART & DISCOUNTS ---
// FIX: Provide explicit generic type to idbGet to prevent it from returning a plain object that doesn't match the expected type.
export const getCart = async (username: string): Promise<{ items: any[], discountCode: string | null }> => {
    if (!username) return { items: [], discountCode: null };
    const cart = await idbGet<{ items: any[], discountCode: string | null }>(`fitgympro_cart_${username}`);
    return cart || { items: [], discountCode: null };
};

export const saveCart = async (username: string, cart: any) => {
    if (!username) return;
    try {
        await idbSet(`fitgympro_cart_${username}`, cart);
    } catch (e) {
        console.error("Failed to save cart to IndexedDB:", e);
        showToast("خطا در ذخیره‌سازی سبد خرید", "error");
    }
};

export interface Discount {
    type: string;
    value: number;
}

// FIX: Provide explicit generic type to idbGet to ensure the returned value matches the expected Record type.
export const getDiscounts = async (): Promise<Record<string, Discount>> => {
    const discounts = await idbGet<Record<string, Discount>>('fitgympro_discounts');
    return discounts || {};
};

export const saveDiscounts = async (discounts: any) => {
    try {
        await idbSet('fitgympro_discounts', discounts);
    } catch (e) {
        console.error("Failed to save discounts to IndexedDB:", e);
        showToast("خطا در ذخیره‌سازی تخفیف‌ها", "error");
    }
};

// --- STORE PLANS ---
// FIX: Provide explicit generic type to idbGet to ensure the returned value is an array.
export const getStorePlans = async (): Promise<any[]> => {
    const plans = await idbGet<any[]>("fitgympro_store_plans");
    return plans || [];
};

export const saveStorePlans = async (plans: any[]) => {
    try {
        await idbSet("fitgympro_store_plans", plans);
    } catch (t) {
        console.error("Error saving store plans to IndexedDB:", t);
        showToast("خطا در ذخیره‌سازی پلن‌ها", "error");
    }
};


// --- NOTIFICATIONS ---
// FIX: Provide explicit generic type to idbGet to ensure the returned value matches the expected Record type.
export const getNotifications = async (username: string): Promise<Record<string, string>> => {
    if (!username) return {};
    const notifications = await idbGet<Record<string, string>>(`fitgympro_notifications_${username}`);
    return notifications || {};
};

export const setNotification = async (username: string, key: string, emoji: string) => {
    if (!username) return;
    const notifications = await getNotifications(username);
    notifications[key] = emoji;
    await idbSet(`fitgympro_notifications_${username}`, notifications);
};

export const clearNotification = async (username: string, key: string) => {
    if (!username) return;
    const notifications = await getNotifications(username);
    delete notifications[key];
    await idbSet(`fitgympro_notifications_${username}`, notifications);
};

export const clearAllNotifications = async (username: string) => {
    if (!username) return;
    await idbDel(`fitgympro_notifications_${username}`);
};


// --- CMS Data (Exercises & Supplements) ---
// FIX: Provide explicit generic type to idbGet to ensure the returned value matches the expected Record type.
export const getExercisesDB = async (): Promise<Record<string, string[]>> => {
    const db = await idbGet<Record<string, string[]>>("fitgympro_exercises");
    return db || {};
};

export const saveExercisesDB = async (db: Record<string, string[]>) => {
    try {
        await idbSet("fitgympro_exercises", db);
    } catch (t) {
        console.error("Error saving exercises to IndexedDB:", t);
        showToast("خطا در ذخیره‌سازی تمرینات", "error");
    }
};

// FIX: Provide explicit generic type to idbGet to ensure the returned value matches the expected Record type.
export const getSupplementsDB = async (): Promise<Record<string, any[]>> => {
    const db = await idbGet<Record<string, any[]>>("fitgympro_supplements");
    return db || {};
};

export const saveSupplementsDB = async (db: Record<string, any[]>) => {
    try {
        await idbSet("fitgympro_supplements", db);
    } catch (t) {
        console.error("Error saving supplements to IndexedDB:", t);
        showToast("خطا در ذخیره‌سازی مکمل‌ها", "error");
    }
};

// --- MAGAZINE ---
// FIX: Provide explicit generic type to idbGet to ensure the returned value is an array.
export const getMagazineArticles = async (): Promise<any[]> => {
    const articles = await idbGet<any[]>("fitgympro_magazine_articles");
    return articles || [];
};

export const saveMagazineArticles = async (articles: any[]) => {
    try {
        await idbSet("fitgympro_magazine_articles", articles);
    } catch (t) {
        console.error("Error saving magazine articles to IndexedDB:", t);
        showToast("خطا در ذخیره‌سازی مقالات", "error");
    }
};


export const seedCMSData = async () => {
    const exercises = await idbGet("fitgympro_exercises");
    if (!exercises || Object.keys(exercises).length === 0) {
        await saveExercisesDB(initialExerciseDB);
        await addActivityLog("Initial exercise database was seeded.");
    }
    const supplements = await idbGet("fitgympro_supplements");
    if (!supplements || Object.keys(supplements).length === 0) {
        await saveSupplementsDB(initialSupplementsDB);
        await addActivityLog("Initial supplement database was seeded.");
    }
    const articles = await getMagazineArticles();
    if (articles.length === 0) {
        const seedArticles = [
            {
                id: `article_${Date.now()}_1`,
                title: "۵ نکته کلیدی برای افزایش حجم عضلانی",
                category: "تغذیه و عضله‌سازی",
                imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=2070&auto=format&fit=crop",
                content: "برای عضله‌سازی موثر، باید روی چند اصل کلیدی تمرکز کنید. اول، دریافت پروتئین کافی. پروتئین واحد سازنده عضلات است و باید روزانه حدود ۱.۶ تا ۲.۲ گرم به ازای هر کیلوگرم وزن بدن مصرف کنید. دوم، مازاد کالری کنترل شده. برای ساخت عضله به انرژی نیاز دارید، اما مازاد بیش از حد منجر به افزایش چربی می‌شود. حدود ۳۰۰-۵۰۰ کالری بیشتر از کالری نگهداری روزانه خود هدف‌گذاری کنید...",
                publishDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: `article_${Date.now()}_2`,
                title: "چگونه بهترین برنامه کاردیو را برای چربی‌سوزی انتخاب کنیم؟",
                category: "هوازی و کاهش وزن",
                imageUrl: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?q=80&w=2070&auto=format&fit=crop",
                content: "تمرینات هوازی یا کاردیو بخش مهمی از هر برنامه کاهش وزن هستند. اما کدام نوع بهتر است؟ تمرینات اینتروال با شدت بالا (HIIT) مانند دویدن‌های سرعتی کوتاه، در زمان کمتر کالری بیشتری می‌سوزانند و متابولیسم را تا ساعت‌ها بالا نگه می‌دارند. از طرف دیگر، تمرینات با شدت یکنواخت و طولانی (LISS) مانند پیاده‌روی سریع یا دوچرخه‌سواری، فشار کمتری به مفاصل وارد کرده و برای ریکاوری بهتر هستند. بهترین رویکرد، ترکیبی از هر دو است.",
                publishDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
        await saveMagazineArticles(seedArticles);
        await addActivityLog("Initial magazine articles were seeded.");
    }
};


// --- Site Settings ---
export const getSiteSettings = async () => {
    const defaults = {
        siteName: 'FitGym Pro',
        logoUrl: '',
        accentColor: '#a3e635',
        maintenanceMode: false,
        allowCoachRegistration: true,
        socialMedia: {
            instagram: 'https://instagram.com/fitgympro',
            telegram: 'https://t.me/fitgympro',
            youtube: 'https://youtube.com/fitgympro'
        },
        contactInfo: {
            email: 'support@fitgympro.com',
            phone: '021-12345678',
            address: 'تهران، خیابان آزادی، پلاک ۱۰۱'
        },
        financial: {
            commissionRate: 30, // As a percentage
            activeGateway: 'zarinpal'
        },
        integrations: {
            paymentGateways: {
                zarinpal: '',
                idpay: ''
            },
            webhooks: [] as {id: string, url: string, events: string[]}[]
        },
        monetization: {
            affiliateSystem: {
                enabled: false,
                commissionRate: 10
            }
        },
        content: {
            terms: 'لطفا قوانین و مقررات خود را در اینجا وارد کنید.',
            privacyPolicy: 'لطفا سیاست حریم خصوصی خود را در اینجا وارد کنید.'
        }
    };
    const settings = await idbGet<any>('fitgympro_site_settings');
    // Deep merge defaults with saved settings. A bit verbose but safe.
    return {
        ...defaults,
        ...(settings || {}),
        socialMedia: { ...defaults.socialMedia, ...(settings?.socialMedia || {}) },
        contactInfo: { ...defaults.contactInfo, ...(settings?.contactInfo || {}) },
        financial: { ...defaults.financial, ...(settings?.financial || {}) },
        integrations: { 
            ...defaults.integrations, 
            ...(settings?.integrations || {}),
            paymentGateways: { ...defaults.integrations.paymentGateways, ...(settings?.integrations?.paymentGateways || {}) },
            webhooks: settings?.integrations?.webhooks || defaults.integrations.webhooks
        },
        monetization: { 
            ...defaults.monetization, 
            ...(settings?.monetization || {}),
            affiliateSystem: { ...defaults.monetization.affiliateSystem, ...(settings?.monetization?.affiliateSystem || {}) }
        },
        content: { ...defaults.content, ...(settings?.content || {}) }
    };
};

export const saveSiteSettings = async (settings: any) => {
    try {
        await idbSet('fitgympro_site_settings', settings);
    } catch (t) {
        console.error("Error saving site settings:", t);
        showToast("خطا در ذخیره‌سازی تنظیمات", "error");
    }
};
