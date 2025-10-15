// This file contains general-purpose helper functions.
import type { UserData, Subscription } from './types';

export const formatPrice = (price: number): string => {
    return `${price.toLocaleString('fa-IR')} تومان`;
};

export const timeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const seconds = Math.round((new Date().getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return "همین الان";
    if (minutes < 60) return `${minutes} دقیقه پیش`;
    if (hours < 24) return `${hours} ساعت پیش`;
    return `${days} روز پیش`;
};

export const getLastActivityDate = (userData: UserData): Date | null => {
    const workoutDates = (userData.workoutHistory || []).map(h => new Date(h.date).getTime());
    const weightDates = (userData.weightHistory || []).map(h => new Date(h.date).getTime());
    const profileUpdateDate = userData.lastProfileUpdate ? new Date(userData.lastProfileUpdate).getTime() : 0;

    const allDates = [...workoutDates, ...weightDates, profileUpdateDate].filter(d => d > 0);
    if (allDates.length === 0) {
        return null;
    }

    const lastTimestamp = Math.max(...allDates);
    return new Date(lastTimestamp);
};

export const getLatestPurchase = (userData: UserData): Subscription | null => {
    if (!userData.subscriptions || userData.subscriptions.length === 0) {
        return null;
    }
    const sortedSubs = [...userData.subscriptions].sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
    const unfulfilled = sortedSubs.find(sub => sub.fulfilled === false);
    return unfulfilled || sortedSubs[0];
};

export const getLatestSubscription = (userData: UserData): Subscription | null => {
    if (!userData.subscriptions || userData.subscriptions.length === 0) {
        return null;
    }
    const sortedSubs = [...userData.subscriptions].sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
    return sortedSubs[0];
};

export const getUserAccessPermissions = (userData: UserData): Set<string> => {
    const permissions = new Set<string>();
    if (userData.subscriptions && userData.subscriptions.length > 0) {
        userData.subscriptions.forEach((sub) => {
            if (sub.access && Array.isArray(sub.access)) {
                sub.access.forEach((p) => permissions.add(p));
            }
        });
    }
    return permissions;
};

export const canUserChat = (userData: UserData): { canChat: boolean; reason: string } => {
    const basePermissions = getUserAccessPermissions(userData);
    if (!basePermissions.has('chat')) {
        return { canChat: false, reason: 'برای دسترسی به این بخش، لطفا یک پلن دارای پشتیبانی خریداری کنید.' };
    }

    const latestProgram = (userData.programHistory && userData.programHistory.length > 0)
        ? userData.programHistory[0]
        : null;
    
    // If they have a plan with chat but no program yet, chat should be active while waiting.
    if (!latestProgram) {
        const latestPurchase = getLatestPurchase(userData);
        if (latestPurchase && !latestPurchase.fulfilled && latestPurchase.access?.includes('chat')) {
             return { canChat: true, reason: 'Chat is active while waiting for program.' };
        }
        return { canChat: false, reason: 'گفتگو با مربی پس از ارسال اولین برنامه شما توسط مربی فعال خواهد شد.' };
    }
    
    // If a program has been sent
    const programSentDate = new Date(latestProgram.date);
    const now = new Date();
    const hoursPassed = (now.getTime() - programSentDate.getTime()) / (1000 * 60 * 60);

    if (hoursPassed <= 48) {
        const hoursLeft = (48 - hoursPassed).toFixed(0);
        return { canChat: true, reason: `Chat is active for ${hoursLeft} more hours.` };
    } else {
        return { canChat: false, reason: 'پشتیبانی ۴۸ ساعته شما پس از دریافت برنامه به پایان رسیده است. برای ارتباط مجدد با مربی، لطفاً پلن خود را تمدید کنید.' };
    }
};

export const getLastActivity = (userData: UserData): string => {
    const lastDate = getLastActivityDate(userData);
    if (!lastDate) {
        return "بدون فعالیت";
    }
    return timeAgo(lastDate.toISOString());
};
