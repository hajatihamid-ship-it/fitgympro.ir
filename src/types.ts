// --- User & Auth ---
export type Role = 'admin' | 'coach' | 'user';
export type UserStatus = 'active' | 'suspended';
export type CoachStatus = 'verified' | 'pending' | 'revoked' | null;
export type CoachTier = 'standard' | 'pro' | 'head_coach';

export interface User {
    username: string;
    email: string;
    password?: string; // Should not be handled on frontend after auth
    role: Role;
    status: UserStatus;
    coachStatus: CoachStatus;
    coachTier?: CoachTier;
    headCoach?: string;
    joinDate: string; // ISO Date string
}

// --- User Profile & Data ---
export interface UserProfile {
    clientName: string;
    clientEmail?: string;
    coachName?: string;
    age?: number;
    height?: number;
    weight?: number;
    gender?: 'مرد' | 'زن';
    activityLevel?: number;
    trainingGoal?: string;
    trainingDays?: number;
    mobile?: string;
    neck?: number;
    waist?: number;
    hip?: number;
    tdee?: number;
    experienceLevel?: 'مبتدی' | 'متوسط' | 'پیشرفته';
    limitations?: string;
    coachNotes?: string; // For local students
}

export interface CoachProfile {
    avatar?: string;
    specialization?: string;
    bio?: string;
}

export interface CoachPerformance {
    rating: number;
    nps: number;
    retentionRate: number;
    avgProgramDeliveryHours: number;
}

export interface Subscription {
    planId: string;
    planName: string;
    price: number;
    purchaseDate: string; // ISO Date string
    fulfilled: boolean;
    access: string[];
}

export interface Exercise {
    name: string;
    sets: number | string;
    reps: number | string;
    rest: number | string;
    is_superset: boolean;
}

export interface WorkoutDay {
    name: string;
    exercises: Exercise[];
}

export interface WorkoutPlan {
    days: WorkoutDay[];
    notes: string;
}

export interface Supplement {
    name: string;
    dosage: string;
    timing: string;
    notes?: string;
}

export interface NutritionMeal {
    mealName: string;
    options: string[];
}

export interface NutritionDay {
    dayName: string;
    meals: NutritionMeal[];
}

export interface NutritionPlan {
    weeklyPlan: NutritionDay[];
    generalTips: string[];
}


export interface Program {
    date: string; // ISO Date string
    step2: WorkoutPlan;
    supplements: Supplement[];
    nutritionPlan?: NutritionPlan;
}


export interface ChatMessage {
    sender: 'user' | 'coach';
    message: string;
    timestamp: string; // ISO Date string;
    read?: boolean;
}

export interface WorkoutLogEntry {
    date: string; // ISO Date string
    dayIndex: number;
    exercises: {
        name: string;
        sets: { weight?: number | string; reps: number | string }[];
    }[];
}

export interface WeightLogEntry {
    date: string; // ISO Date string
    weight: number;
}

export interface FormAnalysisHistoryItem {
    id: string; // e.g., analysis_1678886400000
    date: string; // ISO Date string
    exerciseName: string;
    result: {
        overallRating: string;
        positivePoints: string[];
        improvementPoints: string[];
        summary: string;
    };
}


// The main data object for a user stored in IndexedDB
export interface UserData {
    step1?: UserProfile;
    profile?: CoachProfile;
    students?: number; // coach-specific
    performance?: CoachPerformance; // coach-specific
    localStudents?: any[]; // coach-specific, can be typed better later
    joinDate?: string; // ISO Date string
    subscriptions?: Subscription[];
    programHistory?: any[]; // This has a complex, nested structure. Typed as any for now.
    chatHistory?: ChatMessage[];
    workoutHistory?: WorkoutLogEntry[];
    weightHistory?: WeightLogEntry[];
    lastProfileUpdate?: string; // ISO Date string
    formAnalysisHistory?: FormAnalysisHistoryItem[];
}


// --- Store & CMS ---
export interface StorePlan {
    planId: string;
    planName: string;
    description: string;
    price: number;
    features: string[];
    emoji: string;
    color: string;
    recommended?: boolean;
    access: string[];
}

export interface Discount {
    type: 'percentage' | 'fixed';
    value: number;
}

export interface SupplementDBItem {
    name: string;
    dosageOptions: string[];
    timingOptions: string[];
    note: string;
}

export interface MagazineArticle {
    id: string;
    title: string;
    category: string;
    imageUrl: string;
    content: string;
    publishDate: string; // ISO Date string
    author: string;
}

export interface SiteSettings {
    siteName: string;
    logoUrl: string;
    accentColor: string;
    maintenanceMode: boolean;
    allowCoachRegistration: boolean;
    socialMedia: {
        instagram: string;
        telegram: string;
        youtube: string;
    };
    contactInfo: {
        email: string;
        phone: string;
        address: string;
    };
    financial: {
        commissionRate: number;
        activeGateway: 'zarinpal' | 'idpay';
    };
    integrations: {
        paymentGateways: {
            zarinpal: string;
            idpay: string;
        };
        webhooks: {id: string, url: string, events: string[]}[];
    };
    monetization: {
        affiliateSystem: {
            enabled: boolean;
            commissionRate: number;
        };
    };
    content: {
        terms: string;
        privacyPolicy: string;
    };
}