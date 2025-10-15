import { showToast, closeModal } from '../utils/dom';
import { getUsers, saveUsers, saveUserData, addActivityLog, getUserData, getStorePlans, getCart, saveCart } from '../services/storage';
import { performMetricCalculations } from '../utils/calculations';
import type { User, UserData, SiteSettings } from '../types';

declare var firebase: any;

export const switchAuthForm = (formToShow: 'login' | 'signup' | 'forgot-password' | 'forgot-confirmation') => {
    const containers: { [key: string]: HTMLElement | null } = {
        login: document.getElementById("login-form-container"),
        signup: document.getElementById("signup-form-container"),
        'forgot-password': document.getElementById("forgot-password-form-container"),
        'forgot-confirmation': document.getElementById("forgot-password-confirmation"),
    };
    const formOrder: (keyof typeof containers)[] = ['forgot-password', 'login', 'signup', 'forgot-confirmation'];

    let currentFormKey: keyof typeof containers | null = null;
    let currentIndex = -1;

    // Find currently active form
    for (const key of formOrder) {
        const container = containers[key];
        if (container?.classList.contains('form-active')) {
            currentFormKey = key;
            currentIndex = formOrder.indexOf(key);
            break;
        }
    }

    const newIndex = formOrder.indexOf(formToShow);
    const newContainer = containers[formToShow];
    if (!newContainer) return;

    // If no form is active, it's the initial opening.
    if (!currentFormKey) {
        Object.values(containers).forEach(c => c?.classList.add('hidden'));
        newContainer.classList.remove('hidden');
        requestAnimationFrame(() => {
            newContainer.classList.add('form-active');
        });
        return;
    }

    const oldContainer = containers[currentFormKey];
    if (oldContainer === newContainer) return;

    const direction = newIndex > currentIndex ? 'forward' : 'backward';

    // 1. Prepare new container: move it to its starting position off-screen
    newContainer.classList.remove('hidden');
    newContainer.classList.add(direction === 'forward' ? 'will-enter-from-right' : 'will-enter-from-left');

    // 2. Animate out old container
    oldContainer.classList.remove('form-active');
    oldContainer.classList.add(direction === 'forward' ? 'is-switching-out-left' : 'is-switching-out-right');

    // 3. Force reflow before animating in
    void newContainer.offsetWidth;

    // 4. Animate in new container
    newContainer.classList.remove('will-enter-from-left', 'will-enter-from-right');
    newContainer.classList.add('form-active');

    // 5. Clean up old container after animation
    oldContainer.addEventListener('transitionend', () => {
        oldContainer.classList.add('hidden');
        oldContainer.classList.remove('is-switching-out-left', 'is-switching-out-right');
    }, { once: true });
};


const showValidationError = (inputEl: HTMLInputElement, message: string) => {
    const group = inputEl.closest('.input-group');
    if (!group) return;
    inputEl.classList.add('input-error');
    const errorEl = group.querySelector('.validation-message');
    if (errorEl) errorEl.textContent = message;
};

const clearValidationError = (inputEl: HTMLInputElement) => {
    const group = inputEl.closest('.input-group');
    if (!group) return;
    inputEl.classList.remove('input-error');
    const errorEl = group.querySelector('.validation-message');
    if (errorEl) errorEl.textContent = '';
};

const applyCalculatorData = async (username: string): Promise<boolean> => {
    const calculatorDataRaw = sessionStorage.getItem('fitgympro_calculator_data');
    if (!calculatorDataRaw) return false;

    try {
        const calculatorData = JSON.parse(calculatorDataRaw);
        const userData = await getUserData(username);
        if (!userData.step1) userData.step1 = { clientName: username };

        const step1Data: any = {
            ...userData.step1,
            gender: calculatorData.gender,
            age: parseInt(calculatorData.age, 10),
            height: parseInt(calculatorData.height, 10),
            weight: parseFloat(calculatorData.weight),
            trainingGoal: calculatorData.trainingGoal,
            activityLevel: parseFloat(calculatorData.activityLevel),
            neck: calculatorData.neck ? parseFloat(calculatorData.neck) : undefined,
            waist: calculatorData.waist ? parseFloat(calculatorData.waist) : undefined,
            hip: calculatorData.hip ? parseFloat(calculatorData.hip) : undefined,
        };

        const metrics = performMetricCalculations(step1Data);
        if (metrics && metrics.tdee) {
            step1Data.tdee = metrics.tdee;
        }
        
        userData.step1 = step1Data;

        await saveUserData(username, userData);
        sessionStorage.removeItem('fitgympro_calculator_data');
        return true;

    } catch (e) {
        console.error("Failed to apply calculator data:", e);
        sessionStorage.removeItem('fitgympro_calculator_data');
        return false;
    }
}

const addSelectedPlanToCart = async (username: string): Promise<boolean> => {
    const selectedPlanId = sessionStorage.getItem('fitgympro_selected_plan');
    if (!selectedPlanId) return false;

    const plans = await getStorePlans();
    const planToAdd = plans.find(p => p.planId === selectedPlanId);
    
    if (planToAdd) {
        const cart = await getCart(username);
        // Avoid duplicates
        if (!cart.items.some(item => item.planId === selectedPlanId)) {
            cart.items.push(planToAdd);
            await saveCart(username, cart);
            showToast(`${planToAdd.planName} به سبد خرید اضافه شد.`, 'success');
        }
    }
    
    sessionStorage.removeItem('fitgympro_selected_plan');
    return true;
};

const checkPasswordStrength = (password: string) => {
    const container = document.getElementById('password-strength-container');
    const bars = container?.querySelectorAll('.strength-bar-segment');
    const textEl = document.getElementById('password-strength-text');
    if (!bars || bars.length !== 4 || !textEl) return;

    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    bars.forEach(bar => bar.className = 'strength-bar-segment'); // Reset all
    textEl.className = ''; // Reset text color

    if (password.length === 0) {
        textEl.textContent = '';
        return;
    }

    switch (score) {
        case 1:
            bars[0].classList.add('strength-weak');
            textEl.textContent = 'ضعیف';
            textEl.classList.add('text-weak');
            break;
        case 2:
        case 3:
            bars[0].classList.add('strength-medium');
            bars[1].classList.add('strength-medium');
            if (score === 3) bars[2].classList.add('strength-medium');
            textEl.textContent = 'متوسط';
            textEl.classList.add('text-medium');
            break;
        case 4:
            bars.forEach(b => b.classList.add('strength-strong'));
            textEl.textContent = 'قوی';
            textEl.classList.add('text-strong');
            break;
        default: // Score 0
            textEl.textContent = 'بسیار ضعیف';
            textEl.classList.add('text-weak');
    }
}

const handleGoogleAuth = async (handleLoginActions: (username: string) => Promise<void>) => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;

        if (!user || !user.email) {
            showToast("اطلاعات کافی از حساب گوگل دریافت نشد.", "error");
            return;
        }

        const googleEmail = user.email;
        const googleName = user.displayName;
        let allUsers = await getUsers();
        let appUser = allUsers.find(u => u.email === googleEmail);

        if (appUser) {
            // User exists, log them in
            if (appUser.status === 'suspended') {
                showToast("حساب کاربری شما مسدود شده است.", "error");
                return;
            }
            await handleLoginActions(appUser.username);
        } else {
            // New user, create an account
            let username = googleEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');
            // Ensure username is unique
            let counter = 1;
            let originalUsername = username;
            while (allUsers.some(u => u.username === username)) {
                username = `${originalUsername}${counter}`;
                counter++;
            }

            const newUser: User = {
                username: username,
                email: googleEmail,
                password: `gl_${user.uid}`, // Dummy password using UID for uniqueness
                role: 'user',
                status: 'active',
                coachStatus: null,
                joinDate: new Date().toISOString()
            };
            allUsers.push(newUser);
            await saveUsers(allUsers);

            const newUserData: UserData = {
                step1: { clientName: googleName || username, clientEmail: googleEmail },
                joinDate: new Date().toISOString()
            };
            await saveUserData(username, newUserData);

            await addActivityLog(`${username} signed up via Google.`);
            showToast('ورود با حساب گوگل موفقیت‌آمیز بود.', 'success');
            await handleLoginActions(username);
        }
    } catch (error: any) {
        console.error("Google Auth Error:", error);
        if (error.code === 'auth/popup-closed-by-user') {
            showToast("پنجره ورود گوگل بسته شد.", "warning");
        } else if (error.code === 'auth/popup-blocked') {
            showToast("مرورگر شما پنجره ورود گوگل را مسدود کرده است. لطفاً آن را فعال کنید.", "error");
        } else {
            showToast("خطا در ورود با گوگل. لطفاً دوباره تلاش کنید.", "error");
        }
    }
};


export function initAuthListeners(handleLoginSuccess: (username: string) => void) {
    const authModal = document.getElementById('auth-modal');
    if (!authModal) return;

    const handleLoginActions = async (username: string) => {
        await applyCalculatorData(username);
        await addSelectedPlanToCart(username);
        handleLoginSuccess(username);
    };

    // --- Modal Controls ---
    document.getElementById('close-auth-modal-btn')?.addEventListener('click', () => closeModal(authModal));
    authModal.addEventListener('click', e => {
        if ((e.target as HTMLElement).id === 'auth-modal') {
            closeModal(authModal);
        }
    });

    // --- Form Switching ---
    document.getElementById('switch-to-signup-btn')?.addEventListener('click', () => switchAuthForm('signup'));
    document.getElementById('switch-to-login-btn')?.addEventListener('click', () => switchAuthForm('login'));
    document.getElementById('switch-to-forgot-btn')?.addEventListener('click', () => switchAuthForm('forgot-password'));
    document.getElementById('switch-back-to-login-btn')?.addEventListener('click', () => switchAuthForm('login'));
    document.getElementById('switch-back-to-login-btn-2')?.addEventListener('click', () => switchAuthForm('login'));


    // --- Google Auth ---
    const handleGoogleAuthClick = () => handleGoogleAuth(handleLoginActions);

    document.getElementById('google-login-btn')?.addEventListener('click', handleGoogleAuthClick);
    document.getElementById('google-signup-btn')?.addEventListener('click', handleGoogleAuthClick);

    // --- Form Submissions ---
    const loginForm = document.getElementById("login-form") as HTMLFormElement;
    loginForm?.addEventListener("submit", async e => {
        e.preventDefault();
        const usernameInput = document.getElementById("login-username") as HTMLInputElement;
        const passwordInput = document.getElementById("login-password") as HTMLInputElement;
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        if (!username || !password) {
            showToast("نام کاربری و رمز عبور الزامی است.", "error");
            return;
        }

        const users = await getUsers();
        const user = users.find(u => u.username === username);

        if (user && user.password === password) {
             if (user.status === 'suspended') {
                showToast("حساب کاربری شما مسدود شده است.", "error");
                return;
            }
             if (user.role === 'coach' && user.coachStatus !== 'verified') {
                 showToast("حساب مربیگری شما در انتظار تایید مدیر است.", "error");
                 return;
             }
            await handleLoginActions(username);
        } else {
            showToast("نام کاربری یا رمز عبور اشتباه است.", "error");
            loginForm.closest('.auth-form-panel')?.classList.add('shake-animation');
            setTimeout(() => loginForm.closest('.auth-form-panel')?.classList.remove('shake-animation'), 500);
        }
    });

    const signupForm = document.getElementById("signup-form") as HTMLFormElement;
    const signupPasswordInput = document.getElementById("signup-password") as HTMLInputElement;
    signupPasswordInput?.addEventListener('input', () => checkPasswordStrength(signupPasswordInput.value));

    signupForm?.addEventListener("submit", async e => {
        e.preventDefault();
        const usernameInput = document.getElementById("signup-username") as HTMLInputElement;
        const emailInput = document.getElementById("signup-email") as HTMLInputElement;
        const passwordInput = document.getElementById("signup-password") as HTMLInputElement;
        const isCoachSignup = (document.getElementById("signup-as-coach") as HTMLInputElement)?.checked || false;
        
        clearValidationError(usernameInput);
        clearValidationError(emailInput);
        clearValidationError(passwordInput);

        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        let hasError = false;
        if (username.length < 3) {
            showValidationError(usernameInput, 'نام کاربری باید حداقل ۳ کاراکتر باشد.');
            hasError = true;
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            showValidationError(emailInput, 'لطفا یک ایمیل معتبر وارد کنید.');
            hasError = true;
        }
        if (password.length < 6) {
            showValidationError(passwordInput, 'رمز عبور باید حداقل ۶ کاراکتر باشد.');
            hasError = true;
        }

        if (hasError) return;

        const allUsers = await getUsers();
        const existingUser = allUsers.find(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase());
        if (existingUser) {
            showToast("کاربری با این مشخصات وجود دارد. لطفاً وارد شوید.", "warning");
            switchAuthForm('login');
            const loginUsernameInput = document.getElementById("login-username") as HTMLInputElement;
            const loginPasswordInput = document.getElementById("login-password") as HTMLInputElement;
            if (loginUsernameInput && loginPasswordInput) {
                loginUsernameInput.value = existingUser.username;
                loginPasswordInput.focus();
            }
            return;
        }
        
        const newUser: User = {
            username: username,
            email: email,
            password: password,
            role: isCoachSignup ? 'coach' : 'user',
            status: 'active',
            coachStatus: isCoachSignup ? 'pending' : null,
            joinDate: new Date().toISOString()
        };
        allUsers.push(newUser);
        await saveUsers(allUsers);
        
        const newUserData: UserData = {
            step1: { clientName: username, clientEmail: email },
            joinDate: new Date().toISOString()
        };
        await saveUserData(username, newUserData);
        
        if (isCoachSignup) {
            showToast("ثبت نام شما به عنوان مربی انجام شد. حساب شما پس از تایید مدیر فعال خواهد شد.", "success");
            await addActivityLog(`${username} signed up as a pending coach.`);
            closeModal(authModal);
        } else {
            showToast("ثبت نام با موفقیت انجام شد! در حال ورود...", "success");
            await addActivityLog(`${username} ثبت نام کرد.`);
            await handleLoginActions(username);
        }
    });

    const forgotPasswordForm = document.getElementById("forgot-password-form") as HTMLFormElement;
    forgotPasswordForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('forgot-email') as HTMLInputElement;
        const email = emailInput.value.trim();

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            showToast('لطفا یک ایمیل معتبر وارد کنید.', 'error');
            return;
        }

        const users = await getUsers();
        const userExists = users.some(u => u.email === email);

        if (userExists) {
            // Simulate sending email
            switchAuthForm('forgot-confirmation');
        } else {
            showToast('کاربری با این ایمیل یافت نشد.', 'error');
        }
    });
}

export function renderAuthModal(settings?: SiteSettings) {
    let coachSignupHtml = '';
    if (settings?.allowCoachRegistration) {
        coachSignupHtml = `
        <div class="coach-signup-checkbox">
            <label for="signup-as-coach" class="custom-checkbox-label !gap-3 text-sm">
                <input type="checkbox" id="signup-as-coach" class="custom-checkbox">
                <span>می‌خواهم به عنوان مربی ثبت‌نام کنم</span>
            </label>
        </div>
        `;
    }

    return `
    <div id="auth-modal" class="modal fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] hidden opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center p-4">
        <div class="card w-full max-w-4xl transform scale-95 transition-transform duration-300 grid grid-cols-1 md:grid-cols-5 !p-0">
            <!-- Branding Panel -->
            <div class="auth-branding-panel">
                <div>
                    <h2 class="text-3xl font-bold">به FitGym Pro بپیوندید</h2>
                    <p class="mt-2 opacity-80">مسیر تحول خود را از همین امروز شروع کنید.</p>
                </div>
            </div>

            <!-- Form Panel -->
            <div class="auth-form-panel md:col-span-3">
                <button id="close-auth-modal-btn" class="absolute top-3 left-3 secondary-button !p-2 rounded-full z-10"><i data-lucide="x"></i></button>

                <!-- Login Form -->
                <div id="login-form-container" class="form-container hidden">
                    <div>
                        <h2 class="font-bold text-2xl text-center mb-6">خوش آمدید!</h2>
                        <form id="login-form" class="space-y-4" novalidate>
                            <div class="input-group">
                                <input id="login-username" type="text" class="input-field w-full" placeholder=" " required>
                                <label for="login-username" class="input-label">نام کاربری</label>
                            </div>
                            <div class="input-group relative">
                                <input id="login-password" type="password" class="input-field w-full" placeholder=" " required>
                                <label for="login-password" class="input-label">رمز عبور</label>
                                <button type="button" class="password-toggle" data-target="login-password"><i data-lucide="eye" class="w-5 h-5"></i></button>
                            </div>
                            <div class="flex justify-between items-center text-sm pt-1">
                                <label for="remember-me" class="custom-checkbox-label">
                                    <input type="checkbox" id="remember-me" class="custom-checkbox" checked>
                                    <span>مرا به خاطر بسپار</span>
                                </label>
                                <button id="switch-to-forgot-btn" type="button" class="hover:underline text-text-secondary">فراموشی رمز عبور؟</button>
                            </div>
                            <div class="pt-2">
                                <button type="submit" class="primary-button w-full !py-3 !text-base">ورود</button>
                            </div>
                        </form>
                        <div class="form-divider text-xs">یا</div>
                        <button type="button" id="google-login-btn" class="google-btn">
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo">
                            ورود با حساب گوگل
                        </button>
                        <p class="text-center text-sm text-secondary mt-6">
                            هنوز حساب کاربری ندارید؟
                            <button id="switch-to-signup-btn" type="button" class="font-bold text-accent hover:underline">ثبت نام کنید</button>
                        </p>
                    </div>
                </div>
                
                <!-- Signup Form -->
                <div id="signup-form-container" class="form-container hidden">
                    <div>
                        <h2 class="font-bold text-2xl text-center mb-6">ایجاد حساب کاربری</h2>
                        <form id="signup-form" class="space-y-2" novalidate>
                            <div class="input-group">
                                <input id="signup-username" type="text" class="input-field w-full" placeholder=" " required minlength="3">
                                <label for="signup-username" class="input-label">نام کاربری</label>
                                <div class="validation-message"></div>
                            </div>
                            <div class="input-group">
                                <input id="signup-email" type="email" class="input-field w-full" placeholder=" " required>
                                <label for="signup-email" class="input-label">ایمیل</label>
                                <div class="validation-message"></div>
                            </div>
                            <div class="input-group relative">
                                <input id="signup-password" type="password" class="input-field w-full" placeholder=" " required minlength="6">
                                <label for="signup-password" class="input-label">رمز عبور</label>
                                <button type="button" class="password-toggle" data-target="signup-password"><i data-lucide="eye" class="w-5 h-5"></i></button>
                                <div class="validation-message"></div>
                            </div>
                            <div id="password-strength-container" class="pt-1">
                                <div id="password-strength-meter">
                                    <div class="strength-bar-segment"></div>
                                    <div class="strength-bar-segment"></div>
                                    <div class="strength-bar-segment"></div>
                                    <div class="strength-bar-segment"></div>
                                </div>
                                <p id="password-strength-text" class="text-right"></p>
                            </div>
                            ${coachSignupHtml}
                            <button type="submit" class="primary-button w-full !py-3 !text-base !mt-4">ثبت نام</button>
                        </form>
                        <div class="form-divider text-xs">یا</div>
                        <button type="button" id="google-signup-btn" class="google-btn">
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo">
                            ثبت نام با حساب گوگل
                        </button>
                        <p class="text-center text-sm text-secondary mt-6">
                            قبلا ثبت نام کرده‌اید؟
                            <button id="switch-to-login-btn" type="button" class="font-bold text-accent hover:underline">وارد شوید</button>
                        </p>
                    </div>
                </div>

                <!-- Forgot Password Form -->
                <div id="forgot-password-form-container" class="form-container hidden">
                    <div>
                        <h2 class="font-bold text-2xl text-center mb-6">بازیابی رمز عبور</h2>
                        <p class="text-center text-sm text-secondary mb-6">ایمیل خود را وارد کنید تا لینک بازیابی رمز عبور برایتان ارسال شود.</p>
                        <form id="forgot-password-form" class="space-y-4" novalidate>
                            <div class="input-group">
                                <input id="forgot-email" type="email" class="input-field w-full" placeholder=" " required>
                                <label for="forgot-email" class="input-label">ایمیل</label>
                            </div>
                            <button type="submit" class="primary-button w-full !py-3 !text-base">ارسال لینک بازیابی</button>
                        </form>
                        <p class="text-center text-sm text-secondary mt-6">
                            <button id="switch-back-to-login-btn" type="button" class="font-bold text-accent hover:underline">بازگشت به صفحه ورود</button>
                        </p>
                    </div>
                </div>
                
                <!-- Forgot Password Confirmation -->
                <div id="forgot-password-confirmation" class="form-container hidden text-center">
                    <div>
                        <div class="icon-container">
                            <i data-lucide="mail-check" class="w-8 h-8"></i>
                        </div>
                        <h2 class="font-bold text-xl text-center mb-2">ایمیل ارسال شد!</h2>
                        <p class="text-center text-sm text-secondary mb-6">اگر حساب کاربری با این ایمیل وجود داشته باشد، لینک بازیابی برایتان ارسال شد. لطفاً صندوق ورودی و اسپم خود را بررسی کنید.</p>
                        <button id="switch-back-to-login-btn-2" type="button" class="primary-button w-full">بازگشت به ورود</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
}