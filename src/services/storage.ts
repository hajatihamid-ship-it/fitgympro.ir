// This file centralizes all static data and configuration for the application.
import { showToast } from "../utils/dom";
import { exerciseDB as initialExerciseDB, supplementsDB as initialSupplementsDB } from '../config';
import type { User, UserData, Discount, StorePlan, SupplementDBItem, MagazineArticle, SiteSettings } from '../types';

// --- IndexedDB Helper Functions (inlined for simplicity) ---
const DB_NAME = 'fitgympro-db-kv';
const DB_VERSION = 1;
const STORE_NAME = 'keyValueStore';
let db: IDBDatabase | null;

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        // If we have a valid connection, return it.
        // The `onclose` handler below will nullify `db` if the connection is lost.
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

            // This handler is crucial for robust multi-tab support.
            // If another tab requests a higher DB version, this tab's connection needs to close.
            db.onversionchange = () => {
                if (db) {
                    db.close();
                    console.warn("IndexedDB connection closed due to a version change request.");
                    db = null; // Invalidate the cached connection.
                }
            };
            
            // This handler deals with the connection being closed for other reasons,
            // e.g., by the browser or an OS-level action.
            db.onclose = () => {
                console.warn("IndexedDB connection closed.");
                db = null; // Invalidate the cached connection.
            };

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

export const idbGet = <T>(key: IDBValidKey): Promise<T | undefined> => withStore('readonly', store => store.get(key));
export const idbSet = (key: IDBValidKey, value: any): Promise<void> => withStore('readwrite', store => store.put(value, key)).then(() => {});
export const idbDel = (key: IDBValidKey): Promise<void> => withStore('readwrite', store => store.delete(key));

// --- Users ---
export const getUsers = async (): Promise<User[]> => {
    const users = await idbGet<User[]>("fitgympro_users");
    return users || [];
};

export const saveUsers = async (users: User[]) => {
    try {
        await idbSet("fitgympro_users", users);
    } catch (t) {
        console.error("Error saving users to IndexedDB:", t);
        showToast("خطا در ذخیره‌سازی اطلاعات کاربران", "error");
    }
};

// --- User Data ---
export const getUserData = async (username: string): Promise<UserData> => {
    const data = await idbGet<UserData>(`fitgympro_data_${username}`);
    return data || {};
};

export const saveUserData = async (username: string, data: UserData) => {
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
    const templates = await idbGet<any>("fitgympro_templates");
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
export const getCart = async (username: string): Promise<{ items: StorePlan[], discountCode: string | null }> => {
    if (!username) return { items: [], discountCode: null };
    const cart = await idbGet<{ items: StorePlan[], discountCode: string | null }>(`fitgympro_cart_${username}`);
    return cart || { items: [], discountCode: null };
};

export const saveCart = async (username: string, cart: { items: StorePlan[], discountCode: string | null }) => {
    if (!username) return;
    try {
        await idbSet(`fitgympro_cart_${username}`, cart);
    } catch (e) {
        console.error("Failed to save cart to IndexedDB:", e);
        showToast("خطا در ذخیره‌سازی سبد خرید", "error");
    }
};

export const getDiscounts = async (): Promise<Record<string, Discount>> => {
    const discounts = await idbGet<Record<string, Discount>>('fitgympro_discounts');
    return discounts || {};
};

export const saveDiscounts = async (discounts: Record<string, Discount>) => {
    try {
        await idbSet('fitgympro_discounts', discounts);
    } catch (e) {
        console.error("Failed to save discounts to IndexedDB:", e);
        showToast("خطا در ذخیره‌سازی تخفیف‌ها", "error");
    }
};

// --- STORE PLANS ---
export const getStorePlans = async (): Promise<StorePlan[]> => {
    const plans = await idbGet<StorePlan[]>("fitgympro_store_plans");
    return plans || [];
};

export const saveStorePlans = async (plans: StorePlan[]) => {
    try {
        await idbSet("fitgympro_store_plans", plans);
    } catch (t) {
        console.error("Error saving store plans to IndexedDB:", t);
        showToast("خطا در ذخیره‌سازی پلن‌ها", "error");
    }
};


// --- NOTIFICATIONS ---
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

export const getSupplementsDB = async (): Promise<Record<string, SupplementDBItem[]>> => {
    const db = await idbGet<Record<string, SupplementDBItem[]>>("fitgympro_supplements");
    return db || {};
};

export const saveSupplementsDB = async (db: Record<string, SupplementDBItem[]>) => {
    try {
        await idbSet("fitgympro_supplements", db);
    } catch (t) {
        console.error("Error saving supplements to IndexedDB:", t);
        showToast("خطا در ذخیره‌سازی مکمل‌ها", "error");
    }
};

// --- MAGAZINE ---
export const getMagazineArticles = async (): Promise<MagazineArticle[]> => {
    const articles = await idbGet<MagazineArticle[]>("fitgympro_magazine_articles");
    return articles || [];
};

export const saveMagazineArticles = async (articles: MagazineArticle[]) => {
    try {
        await idbSet("fitgympro_magazine_articles", articles);
    } catch (t) {
        console.error("Error saving magazine articles to IndexedDB:", t);
        showToast("خطا در ذخیره‌سازی مقالات", "error");
    }
};


export const seedCMSData = async () => {
    // --- Exercises Synchronization ---
    let exercisesModified = false;
    const exercises = await idbGet<Record<string, string[]>>("fitgympro_exercises") || {};
    const exercisesToWrite = JSON.parse(JSON.stringify(exercises)); // Deep copy to avoid modifying the read object

    for (const group in initialExerciseDB) {
        if (!exercisesToWrite[group]) {
            exercisesToWrite[group] = [];
            exercisesModified = true;
        }
        const exerciseSet = new Set(exercisesToWrite[group]);
        const originalSize = exerciseSet.size;
        initialExerciseDB[group].forEach(ex => exerciseSet.add(ex));
        if (exerciseSet.size > originalSize) {
            exercisesToWrite[group] = Array.from(exerciseSet);
            exercisesModified = true;
        }
    }

    if (exercisesModified) {
        await saveExercisesDB(exercisesToWrite);
        await addActivityLog("Exercise database was synchronized.");
    }

    // --- Supplements Synchronization ---
    let supplementsModified = false;
    const supplements = await idbGet<Record<string, SupplementDBItem[]>>("fitgympro_supplements") || {};
    const supplementsToWrite = JSON.parse(JSON.stringify(supplements));

    for (const category in initialSupplementsDB) {
        if (!supplementsToWrite[category]) {
            supplementsToWrite[category] = [];
            supplementsModified = true;
        }
        const supplementMap = new Map(supplementsToWrite[category].map(s => [s.name, s]));
        const originalSize = supplementMap.size;
        initialSupplementsDB[category].forEach(sup => {
            if (!supplementMap.has(sup.name)) {
                supplementMap.set(sup.name, sup);
            }
        });
        if (supplementMap.size > originalSize) {
            supplementsToWrite[category] = Array.from(supplementMap.values());
            supplementsModified = true;
        }
    }

    if (supplementsModified) {
        await saveSupplementsDB(supplementsToWrite);
        await addActivityLog("Supplement database was synchronized.");
    }

    // --- Magazine Articles Seeding (only if empty) ---
    const articles = await getMagazineArticles();
    if (articles.length === 0) {
        const seedArticles: MagazineArticle[] = [
            {
                id: `article_${Date.now()}_1`,
                title: "۵ نکته کلیدی برای افزایش حجم عضلانی",
                category: "تغذیه و عضله‌سازی",
                imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=2070&auto=format&fit=crop",
                content: "برای عضله‌سازی موثر، باید روی چند اصل کلیدی تمرکز کنید. اول، دریافت پروتئین کافی. پروتئین واحد سازنده عضلات است و باید روزانه حدود ۱.۶ تا ۲.۲ گرم به ازای هر کیلوگرم وزن بدن مصرف کنید. دوم، مازاد کالری کنترل شده. برای ساخت عضله به انرژی نیاز دارید، اما مازاد بیش از حد منجر به افزایش چربی می‌شود. حدود ۳۰۰-۵۰۰ کالری بیشتر از کالری نگهداری روزانه خود هدف‌گذاری کنید...",
                publishDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                author: 'admin10186'
            },
            {
                id: `article_${Date.now()}_2`,
                title: "چگونه بهترین برنامه کاردیو را برای چربی‌سوزی انتخاب کنیم؟",
                category: "هوازی و کاهش وزن",
                imageUrl: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?q=80&w=2070&auto=format&fit=crop",
                content: "تمرینات هوازی یا کاردیو بخش مهمی از هر برنامه کاهش وزن هستند. اما کدام نوع بهتر است؟ تمرینات اینتروال با شدت بالا (HIIT) مانند دویدن‌های سرعتی کوتاه، در زمان کمتر کالری بیشتری می‌سوزانند و متابولیسم را تا ساعت‌ها بالا نگه می‌دارند. از طرف دیگر، تمرینات با شدت یکنواخت و طولانی (LISS) مانند پیاده‌روی سریع یا دوچرخه‌سواری، فشار کمتری به مفاصل وارد کرده و برای ریکاوری بهتر هستند. بهترین رویکرد، ترکیبی از هر دو است.",
                publishDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                author: 'admin10186'
            },
            {
                id: `article_${Date.now()}_3`,
                title: "فراتر از حرکت: چرا 'ارتباط ذهن و عضله' یک شعار نیست؟",
                category: "علم تمرین",
                imageUrl: "https://images.unsplash.com/photo-1581009137042-c552e485697a?q=80&w=2070&auto=format&fit=crop",
                content: "شاید شنیده باشید که مربیان می‌گویند 'روی عضله‌ای که تمرین می‌دهی تمرکز کن'، اما این فقط یک عبارت انگیزشی نیست. ارتباط ذهن و عضله یک مفهوم علمی است که می‌تواند نتایج تمرین شما را به طرز چشمگیری بهبود ببخشد. وقتی شما به صورت آگاهانه روی انقباض یک عضله خاص تمرکز می‌کنید، سیگنال‌های عصبی قوی‌تری از مغز به آن عضله ارسال می‌شود. این امر منجر به فعال‌سازی تعداد بیشتری از فیبرهای عضلانی شده و در نتیجه، تحریک بیشتری برای رشد ایجاد می‌کند. برای بهبود این ارتباط، سعی کنید حرکات را با وزنه‌های سبک‌تر و به صورت آهسته و کنترل شده انجام دهید، در بالاترین نقطه انقباض عضله را برای لحظه‌ای منقبض نگه دارید و چشمان خود را ببندید تا بهتر بتوانید روی حس عضله تمرکز کنید.",
                publishDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                author: 'admin10186'
            },
            {
                id: `article_${Date.now()}_4`,
                title: "سوخت‌رسانی هوشمند: ۵ اشتباه رایج تغذیه قبل و بعد از تمرین",
                category: "تغذیه و رژیم",
                imageUrl: "https://images.unsplash.com/photo-1543353071-873f67a48e03?q=80&w=2070&auto=format&fit=crop",
                content: "تغذیه صحیح قبل و بعد از تمرین به اندازه خود تمرین اهمیت دارد. اجتناب از این ۵ اشتباه رایج می‌تواند عملکرد و ریکاوری شما را متحول کند: ۱. مصرف چربی زیاد قبل از تمرین: چربی‌ها هضم را کند کرده و ممکن است باعث احساس سنگینی شوند. ۲. تمرین با معده خالی (در همه موارد): برای تمرینات شدید، کربوهیدرات‌های زود هضم برای تامین انرژی ضروری هستند. ۳. تاخیر در مصرف پروتئین بعد از تمرین: عضلات شما پس از تمرین برای ترمیم به پروتئین نیاز دارند؛ سعی کنید در یک بازه ۱-۲ ساعته پروتئین مصرف کنید. ۴. عدم نوشیدن آب کافی: دهیدراتاسیون یا کم‌آبی می‌تواند به شدت عملکرد شما را کاهش دهد. ۵. نادیده گرفتن کربوهیدرات بعد از تمرین: کربوهیدرات‌ها به بازسازی ذخایر گلیکوژن عضلات و تسریع ریکاوری کمک می‌کنند. یک وعده متعادل شامل پروتئین و کربوهیدرات بهترین گزینه است.",
                publishDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                author: 'admin10186'
            },
            {
                id: `article_${Date.now()}_5`,
                title: "وقتی انگیزه تمام می‌شود: چگونه با 'انضباط' به مسیر ادامه دهیم؟",
                category: "روانشناسی و انگیزه",
                imageUrl: "https://images.unsplash.com/photo-1517836357463-d257692634ce?q=80&w=2070&auto=format&fit=crop",
                content: "انگیزه مانند یک جرقه است؛ روشن می‌شود، اما ممکن است به سرعت خاموش شود. در مقابل، انضباط مانند موتوری است که حتی در نبود جرقه اولیه، شما را به جلو می‌راند. همه ما روزهایی را تجربه می‌کنیم که حس تمرین کردن نداریم. در این روزها، تکیه بر انضباط و عادت‌هاست که تفاوت را رقم می‌زند. برای ساختن انضباط، یک برنامه ورزشی مشخص برای خود تعیین کنید و به آن پایبند باشید، حتی اگر فقط ۱۰ دقیقه تمرین کنید. موفقیت‌های کوچک را جشن بگیرید و به جای تمرکز بر نتیجه نهایی، روی فرآیند و هویت خود به عنوان یک 'فرد ورزشکار' تمرکز کنید. به یاد داشته باشید که ثبات و استمرار، حتی با شدت کمتر، همیشه از تمرینات شدید و پراکنده بهتر است.",
                publishDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
                author: 'admin10186'
            },
            {
                id: `article_${Date.now()}_6`,
                title: "کراتین: افسانه یا واقعیت؟ هر آنچه باید بدانید.",
                category: "مکمل‌ها",
                imageUrl: "https://images.unsplash.com/photo-1599599810694-b5b37304c847?q=80&w=2070&auto=format&fit=crop",
                content: "کراتین یکی از پرتحقیق‌ترین و موثرترین مکمل‌های ورزشی در جهان است، اما شایعات زیادی پیرامون آن وجود دارد. کراتین به طور طبیعی در بدن یافت می‌شود و به بازسازی سریع انرژی (ATP) در حین تمرینات کوتاه و شدید کمک می‌کند. مصرف مکمل کراتین (معمولاً کراتین مونوهیدرات) می‌تواند به افزایش قدرت، توان و حجم عضلانی کمک کند. برخلاف باورهای غلط، تحقیقات گسترده نشان داده‌اند که مصرف کراتین در دوزهای استاندارد (۳-۵ گرم در روز) برای افراد سالم ایمن است و به کلیه‌ها آسیب نمی‌رساند. نیازی به دوره 'بارگیری' نیست و می‌توانید آن را هر روز، در هر زمانی از روز مصرف کنید. کراتین یک مکمل جادویی نیست، اما ابزاری قدرتمند برای بهبود عملکرد در کنار تمرین و تغذیه مناسب است.",
                publishDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
                author: 'admin10186'
            }
        ];
        await saveMagazineArticles(seedArticles);
        await addActivityLog("Initial magazine articles were seeded.");
    }
};


// --- Site Settings ---
export const getSiteSettings = async (): Promise<SiteSettings> => {
    const defaults: SiteSettings = {
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
            webhooks: []
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
    const settings = await idbGet<Partial<SiteSettings>>('fitgympro_site_settings');
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

export const saveSiteSettings = async (settings: SiteSettings) => {
    try {
        await idbSet('fitgympro_site_settings', settings);
    } catch (t) {
        console.error("Error saving site settings:", t);
        showToast("خطا در ذخیره‌سازی تنظیمات", "error");
    }
};
