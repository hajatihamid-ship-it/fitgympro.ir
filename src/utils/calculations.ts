// This file contains all business logic calculations for fitness metrics.
import type { UserData, WorkoutLogEntry } from '../types';

interface MetricCalculationData {
    age: number;
    height: number;
    weight: number;
    gender: string;
    activityLevel: number;
    neck?: number;
    waist?: number;
    hip?: number;
}

export const performMetricCalculations = (data: MetricCalculationData) => {
    const { age, height, weight, gender, activityLevel, neck, waist, hip } = data;
    if (!age || !height || !weight || !gender) return null;

    const s = age, r = height, a = weight;
    const o = gender === "مرد";
    const d = activityLevel;
    const c = neck, g = waist, x = hip;

    const heightInMeters = r / 100;
    const bmi = a / (heightInMeters * heightInMeters);
    const bmr = o ? 10 * a + 6.25 * r - 5 * s + 5 : 10 * a + 6.25 * r - 5 * s - 161;

    let bodyFat = 0;
    if (c && g && c > 0 && g > 0) {
        if (o) {
            bodyFat = 86.01 * Math.log10(g - c) - 70.041 * Math.log10(r) + 36.76;
        } else if (x && x > 0) {
            bodyFat = 163.205 * Math.log10(g + x - c) - 97.684 * Math.log10(r) - 78.387;
        }
    }

    const metrics = {
        bmi: !isNaN(bmi) ? parseFloat(bmi.toFixed(1)) : null,
        bmr: !isNaN(bmr) ? Math.round(bmr) : null,
        tdee: null as number | null,
        idealWeight: `${(18.5 * heightInMeters * heightInMeters).toFixed(1)} - ${(24.9 * heightInMeters * heightInMeters).toFixed(1)} kg`,
        bodyFat: null as number | null,
        lbm: null as number | null,
    };

    if (!isNaN(bmr) && !isNaN(d)) {
        metrics.tdee = Math.round(bmr * d);
    }
    
    if (bodyFat > 0 && bodyFat < 100) {
        metrics.bodyFat = parseFloat(bodyFat.toFixed(1));
        metrics.lbm = parseFloat((a * (1 - bodyFat / 100)).toFixed(1));
    }

    return metrics;
};

export const calculateMacros = (tdee: number, weight: number, goal: string) => {
    if (!tdee || !weight || !goal) return { protein: 0, carbs: 0, fat: 0 };
    
    let calorieTarget = tdee;
    if (goal === 'کاهش وزن') {
        calorieTarget -= 400;
    } else if (goal === 'افزایش حجم') {
        calorieTarget += 300;
    }

    const proteinGrams = Math.round(weight * 1.8);
    const proteinCalories = proteinGrams * 4;

    const fatCalories = Math.round(calorieTarget * 0.25);
    const fatGrams = Math.round(fatCalories / 9);

    const carbCalories = calorieTarget - proteinCalories - fatCalories;
    const carbGrams = Math.round(carbCalories / 4);

    return {
        protein: proteinGrams > 0 ? proteinGrams : 0,
        carbs: carbGrams > 0 ? carbGrams : 0,
        fat: fatGrams > 0 ? fatGrams : 0
    };
};


export const calculateBodyMetrics = (container: HTMLElement) => {
    const s = parseFloat((container.querySelector(".age-slider") as HTMLInputElement).value);
    const r = parseFloat((container.querySelector(".height-slider") as HTMLInputElement).value);
    const a = parseFloat((container.querySelector(".weight-slider") as HTMLInputElement).value);

    let n: HTMLInputElement | null = null;
    const genderRadios = container.querySelectorAll('input[name="gender"], input[name="gender_user"], input[name="gender_calc"]');
    for (const radio of Array.from(genderRadios)) {
        if ((radio as HTMLInputElement).checked || radio.getAttribute('data-is-checked') === 'true') {
            n = radio as HTMLInputElement;
            break;
        }
    }

    if (!n) return null;

    let m: HTMLInputElement | null = null;
    const activityRadios = container.querySelectorAll('input[name="activity_level"], input[name="activity_level_user"], input[name="activity_level_calc"]');
    for (const radio of Array.from(activityRadios)) {
        if ((radio as HTMLInputElement).checked || radio.getAttribute('data-is-checked') === 'true') {
            m = radio as HTMLInputElement;
            break;
        }
    }
    
    const d = m ? parseFloat(m.value) : 1.2;
    
    const neckInput = container.querySelector(".neck-input") as HTMLInputElement | null;
    const waistInput = container.querySelector(".waist-input") as HTMLInputElement | null;
    const hipInput = container.querySelector(".hip-input") as HTMLInputElement | null;
    const c = neckInput ? parseFloat(neckInput.value) : NaN;
    const g = waistInput ? parseFloat(waistInput.value) : NaN;
    const x = hipInput ? parseFloat(hipInput.value) : NaN;

    if (isNaN(r) || isNaN(a) || r <= 0 || a <= 0) {
        return null;
    }

    return performMetricCalculations({
        age: s, height: r, weight: a, gender: n.value, activityLevel: d,
        neck: c, waist: g, hip: x
    });
};

export const calculateWorkoutStreak = (history: WorkoutLogEntry[] = []) => {
    if (!history || history.length === 0) return 0;
    const workoutDates = history.map(log => log.date);
    const oneDay = 864e5;
    const uniqueDays = [...new Set(workoutDates.map(dateStr => new Date(dateStr).setHours(0, 0, 0, 0)))].sort((a, b) => b - a);
    if (uniqueDays.length === 0 || (new Date().setHours(0, 0, 0, 0) - uniqueDays[0]) > oneDay) {
        return 0;
    }
    let streak = 1;
    for (let i = 0; i < uniqueDays.length - 1; i++) {
        if ((uniqueDays[i] - uniqueDays[i + 1]) / oneDay === 1) {
            streak++;
        } else {
            break;
        }
    }
    return streak;
};

export const getTodayWorkoutData = (userData: UserData) => {
    // Find the current program plan from history
    const latestProgram = (userData.programHistory && userData.programHistory.length > 0)
        ? userData.programHistory[0]
        : null;

    if (!latestProgram || !latestProgram.step2 || !latestProgram.step2.days || latestProgram.step2.days.length === 0) return null;

    const workoutPlan = latestProgram.step2;
    
    // Match by day name, which is more robust.
    const dayNames = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
    const todayName = dayNames[new Date().getDay()];

    const todayDayIndex = workoutPlan.days.findIndex((day: any) => day.name.startsWith(todayName));

    if (todayDayIndex !== -1 && workoutPlan.days[todayDayIndex].exercises.length > 0) {
        return {
            day: workoutPlan.days[todayDayIndex],
            dayIndex: todayDayIndex
        };
    }
    
    return null;
};

export const calculateWeeklyMetrics = (history: WorkoutLogEntry[] = []) => {
    if (!history || history.length === 0) {
        return { labels: [], volumes: [], frequencies: [] };
    }

    const getWeekStartDate = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay(); // Sunday - 0, ... Saturday - 6
        const diff = (day + 1) % 7; // Sunday: 1, ..., Saturday: 0
        date.setDate(date.getDate() - diff);
        return date.setHours(0, 0, 0, 0);
    };

    const weeklyData: Record<number, { volume: number, workoutDays: Set<string> }> = {};

    history.forEach(log => {
        const logDate = new Date(log.date);
        const weekStartTimestamp = getWeekStartDate(logDate);

        if (!weeklyData[weekStartTimestamp]) {
            weeklyData[weekStartTimestamp] = { volume: 0, workoutDays: new Set() };
        }

        weeklyData[weekStartTimestamp].workoutDays.add(logDate.toDateString());

        (log.exercises || []).forEach((ex) => {
            (ex.sets || []).forEach((set) => {
                const weight = parseFloat(String(set.weight)) || 0;
                const reps = parseInt(String(set.reps), 10) || 0;
                if (weight > 0 && reps > 0) {
                    weeklyData[weekStartTimestamp].volume += weight * reps;
                }
            });
        });
    });

    const sortedWeeks = Object.keys(weeklyData).map(Number).sort((a, b) => a - b);
    
    const recentWeeks = sortedWeeks.slice(-12);

    const labels = recentWeeks.map(ts => new Date(ts).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }));
    const volumes = recentWeeks.map(ts => Math.round(weeklyData[ts].volume));
    const frequencies = recentWeeks.map(ts => weeklyData[ts].workoutDays.size);
    
    return { labels, volumes, frequencies };
};

export const findBestLifts = (history: WorkoutLogEntry[] = [], targetExercises: string[]) => {
    const bestLifts: Record<string, { weight: number, reps: number, date: string }> = {};

    history.forEach(log => {
        (log.exercises || []).forEach((ex) => {
            if (targetExercises.includes(ex.name)) {
                (ex.sets || []).forEach((set) => {
                    const weight = parseFloat(String(set.weight)) || 0;
                    const reps = parseInt(String(set.reps), 10) || 0;

                    if (weight > 0 && reps > 0) {
                        const currentBest = bestLifts[ex.name];
                        if (!currentBest || weight > currentBest.weight || (weight === currentBest.weight && reps > currentBest.reps)) {
                            bestLifts[ex.name] = { weight, reps, date: log.date };
                        }
                    }
                });
            }
        });
    });

    return targetExercises.map(exerciseName => ({
        exerciseName,
        ...bestLifts[exerciseName]
    }));
};

export const getWeightChange = (userData: UserData) => {
    if (!userData.weightHistory || userData.weightHistory.length < 2) {
        return { change: 0, trend: 'neutral' };
    }
    const firstWeight = userData.weightHistory[0].weight;
    const lastWeight = userData.weightHistory[userData.weightHistory.length - 1].weight;
    const change = lastWeight - firstWeight;
    let trend = 'neutral';
    if (change > 0) trend = 'up';
    if (change < 0) trend = 'down';

    return { change: parseFloat(change.toFixed(1)), trend };
};

export const getWorkoutsThisWeek = (history: WorkoutLogEntry[] = []): number => {
    if (!history) return 0;
    const now = new Date();
    // In Iran, week starts on Saturday. getDay() has Sunday as 0.
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 6 ? 0 : dayOfWeek + 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const workoutDatesThisWeek = history
        .map(log => new Date(log.date))
        .filter(date => date >= startOfWeek);
        
    const uniqueDays = new Set(workoutDatesThisWeek.map(date => date.toDateString()));
    return uniqueDays.size;
};
