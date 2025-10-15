import { getGenAI } from '../state';
import { showToast } from "../utils/dom";
import { getExercisesDB, getSupplementsDB } from "./storage";
import { Type } from "@google/genai";
import type { UserData, UserProfile } from '../types';

export const generateNutritionPlan = async (userData: UserData): Promise<any | null> => {
    const ai = getGenAI();
    const tdee = userData.step1?.tdee || 2500;
    const goal = userData.step1?.trainingGoal || "حفظ وزن";
    const name = userData.step1?.clientName || "ورزشکار";

    let calorieTarget = tdee;
    if (goal === "کاهش وزن") {
        calorieTarget = tdee * 0.8;
    } else if (goal === "افزایش حجم") {
        calorieTarget = tdee * 1.15;
    }

    const prompt = `
        برای یک ورزشکار به نام "${name}" با هدف "${goal}" و کالری هدف روزانه حدود ${Math.round(calorieTarget)} کیلوکالری، یک برنامه غذایی نمونه برای یک هفته کامل (۷ روز) طراحی کن. این برنامه برای تکرار در طول یک ماه در نظر گرفته شده است.
        برای هر روز هفته، ۵ وعده (صبحانه، میان‌وعده صبح، ناهار، میان‌وعده عصر، شام) با چند گزینه غذایی متنوع پیشنهاد بده.
        در انتها چند نکته عمومی و مهم هم اضافه کن.
        کل خروجی باید به زبان فارسی باشد.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        weeklyPlan: {
                            type: Type.ARRAY,
                            description: "آرایه‌ای از ۷ آبجکت، هر کدام برای یک روز هفته.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    dayName: { type: Type.STRING, description: "نام روز هفته (مثلا 'روز اول: شنبه')." },
                                    meals: {
                                        type: Type.ARRAY,
                                        description: "آرایه‌ای از ۵ آبجکت وعده غذایی برای این روز.",
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                mealName: { type: Type.STRING, description: "نام وعده (مثلا 'صبحانه')." },
                                                options: {
                                                    type: Type.ARRAY,
                                                    description: "چندین گزینه غذایی برای این وعده.",
                                                    items: { type: Type.STRING }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        generalTips: {
                            type: Type.ARRAY,
                            description: "لیستی از نکات عمومی و مهم.",
                            items: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("AI Nutrition Plan Error:", error);
        showToast("خطا در تولید برنامه غذایی", "error");
        return null;
    }
};


export const generateWorkoutPlan = async (studentData: UserProfile): Promise<any | null> => {
    const ai = getGenAI();
    
    const { age, gender, trainingGoal, trainingDays, limitations } = studentData;
    if (!age || !gender || !trainingGoal || !trainingDays) {
        showToast("اطلاعات شاگرد برای تولید برنامه کافی نیست.", "error");
        return null;
    }

    // Create a list of available muscle groups to guide the AI, instead of all exercises, to prevent request size errors.
    const exerciseDB = await getExercisesDB();
    const availableMuscleGroups = Object.keys(exerciseDB).join(', ');
    
    const limitationsInstruction = limitations
        ? `\nCRITICAL SAFETY INSTRUCTION: The client has the following limitations: "${limitations}". You MUST avoid exercises that could strain these areas. Prioritize safety and suggest safe alternatives.`
        : '';

    const prompt = `
        You are an expert fitness coach. Create a personalized ${trainingDays}-day workout plan for a client with the following details:
        - Age: ${age}
        - Gender: ${gender}
        - Primary Goal: ${trainingGoal}
        ${limitationsInstruction}

        Instructions:
        1. Design a weekly split appropriate for the number of training days. For example, for 4 days, you might use an Upper/Lower split or a Body Part split.
        2. For each training day, provide a clear name in Persian (e.g., "شنبه: سینه و پشت بازو").
        3. For each exercise, provide a reasonable number of sets, reps, and rest period in seconds, tailored to the client's goal.
        4. Choose common, effective, and safe exercises. The available muscle group categories are: ${availableMuscleGroups}. Ensure the exercises you select are well-known and standard gym exercises that would exist in a comprehensive fitness app database.
        5. Provide a final "notes" field in Persian with general advice like warming up and hydration.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        days: {
                            type: Type.ARRAY,
                            description: "An array of daily workout objects, one for each training day.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING, description: "The name of the workout day (e.g., 'شنبه: سینه و پشت بازو')." },
                                    exercises: {
                                        type: Type.ARRAY,
                                        description: "A list of exercises for this day.",
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                name: { type: Type.STRING, description: "The name of the exercise." },
                                                sets: { type: Type.INTEGER, description: "Number of sets." },
                                                reps: { type: Type.INTEGER, description: "Number of repetitions per set." },
                                                rest: { type: Type.INTEGER, description: "Rest time in seconds between sets." }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        notes: {
                            type: Type.STRING,
                            description: "General notes and advice for the client."
                        }
                    }
                }
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("AI Workout Plan Error:", error);
        showToast("خطا در تولید برنامه تمرینی با AI", "error");
        return null;
    }
};

export const generateSupplementPlan = async (studentData: UserProfile, goal: string): Promise<any[] | null> => {
    const ai = getGenAI();
    const supplementsDB = await getSupplementsDB();
    const availableSupplements: string[] = [];
    Object.values(supplementsDB).forEach(category => {
        category.forEach(sup => {
            availableSupplements.push(sup.name);
        });
    });

    const prompt = `
        Based on the client's primary goal of "${goal}" and their details (Age: ${studentData.age}, Gender: ${studentData.gender}), suggest a stack of 2 to 4 essential supplements.
        For each supplement, provide the most common "dosage" and "timing" based on its properties, selecting from the available options for each supplement.
        ONLY use supplements from this list: ${availableSupplements.join(', ')}.
        Do not suggest anything not on the list.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        supplements: {
                            type: Type.ARRAY,
                            description: "An array of suggested supplement objects.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING, description: "Name of the supplement." },
                                    dosage: { type: Type.STRING, description: "Suggested dosage." },
                                    timing: { type: Type.STRING, description: "Suggested timing for consumption." }
                                }
                            }
                        }
                    }
                }
            }
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        return result.supplements || null;
    } catch (error) {
        console.error("AI Supplement Plan Error:", error);
        showToast("خطا در پیشنهاد مکمل با AI", "error");
        return null;
    }
};

export const generateFoodReplacements = async (
    studentData: UserProfile,
    mealName: string,
    foodToReplace: string
): Promise<string[] | null> => {
    const ai = getGenAI();
    const tdee = studentData?.tdee || 2500;
    const goal = studentData?.trainingGoal || "حفظ وزن";

    const prompt = `
        For a client with the goal of "${goal}" and a daily calorie target around ${tdee} kcal, suggest exactly 3 healthy and nutritionally similar alternatives for the food item "${foodToReplace}".
        This food item is part of the "${mealName}" meal. The suggestions should be appropriate for this meal.
        Return the suggestions as a JSON object containing an array of strings in Persian.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        "پیشنهادات": {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING
                            }
                        }
                    }
                }
            }
        });
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        return result.پیشنهادات || null;
    } catch (error) {
        console.error("AI Food Replacement Error:", error);
        showToast("خطا در دریافت پیشنهاد جایگزین", "error");
        return null;
    }
};

export const generateCoachingInsight = async (coachData: UserData, students: any[]): Promise<string | null> => {
    const ai = getGenAI();
    try {
        const retentionRate = coachData.performance?.retentionRate || 92;
        const prompt = `As a world-class coach business consultant, give me one actionable tip in Persian to improve my fitness coaching business. 
        I currently have ${students.length} students. My client retention rate is ${retentionRate}%. 
        My main goal is to increase student engagement and attract new clients.
        Keep the response concise, friendly, and directly actionable.
        Start with a positive reinforcement.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });

        return response.text;

    } catch (error) {
        console.error("AI Insight Error:", error);
        showToast("خطا در ارتباط با سرویس هوش مصنوعی", "error");
        return null;
    }
};

export const generateExerciseSuggestion = async (muscleGroup: string, trainingGoal: string): Promise<{ exerciseName: string } | null> => {
    const ai = getGenAI();
    const exerciseDB = await getExercisesDB();
    const availableExercises = Object.values(exerciseDB).flat().join(', ');

    const prompt = `
        You are an expert fitness coach. Your task is to suggest ONE single exercise.
        - The client's primary goal is: "${trainingGoal}".
        - The target muscle group for today is: "${muscleGroup}".
        - You MUST choose one exercise from the following list of available exercises: ${availableExercises}.
        - Do not suggest any exercise not on this list.
        - Consider the goal. For "افزایش حجم" (mass gain), compound movements are good. For "کاهش وزن" (weight loss), full-body or high-intensity moves can be good.
        - Return your answer in JSON format with a single key "exerciseName".
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        exerciseName: {
                            type: Type.STRING,
                            description: "The name of the suggested exercise, chosen from the provided list."
                        }
                    }
                }
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("AI Exercise Suggestion Error:", error);
        showToast("خطا در تولید پیشنهاد حرکت ورزشی", "error");
        return null;
    }
};

export const generateUserWorkoutInsight = async (userData: UserData): Promise<string | null> => {
    const ai = getGenAI();
    const { workoutHistory, step1 } = userData;

    if (!workoutHistory || workoutHistory.length < 3) {
        return "برای ارائه تحلیل دقیق، حداقل به ۳ جلسه تمرین ثبت شده نیاز است. به تمرین ادامه دهید!";
    }

    // Format the last 10 workouts for the prompt
    const formattedHistory = workoutHistory.slice(-10).map((log) => {
        const date = new Date(log.date).toLocaleDateString('fa-IR');
        const exercises = (log.exercises || []).map((ex) => {
            const sets = (ex.sets || []).map((s) => `${s.reps}x${s.weight || 'BW'}`).join(', ');
            return `${ex.name}: ${sets}`;
        }).join('; ');
        return `- تاریخ: ${date}, تمرینات: ${exercises}`;
    }).join('\n');

    const prompt = `
    شما یک مربی بدنسازی حرفه‌ای و مشوق هستید. اطلاعات کاربر و تاریخچه تمرینات اخیر او در زیر آمده است. این اطلاعات را تحلیل کرده و به زبان فارسی، یک بازخورد سازنده و شخصی‌سازی شده ارائه دهید.
    
    **اطلاعات کاربر:**
    - هدف: ${step1?.trainingGoal || 'نامشخص'}
    - روزهای تمرین در هفته: ${step1?.trainingDays || 'نامشخص'}

    **تاریخچه تمرینات اخیر (۱۰ جلسه آخر):**
    ${formattedHistory}

    **وظیفه شما:**
    1.  **تحلیل کلی**: به صورت کلی عملکرد کاربر را بررسی کنید. آیا ثبات دارد؟ آیا حجم تمرین مناسب به نظر می‌رسد؟
    2.  **شناسایی نقاط قوت**: یک نکته مثبت در مورد تمرینات او پیدا کنید (مثلا ثبات، افزایش وزنه در یک حرکت خاص، یا تنوع خوب).
    3.  **ارائه ۲ تا ۳ پیشنهاد عملی**: چند پیشنهاد مشخص برای بهبود ارائه دهید. این پیشنهادات می‌تواند شامل موارد زیر باشد:
        -   توجه به گروه‌های عضلانی کمتر تمرین داده شده برای ایجاد تعادل.
        -   پیشنهاد تغییر در تعداد تکرار یا ست برای یک هدف خاص (مثلا افزایش قدرت یا هایپرتروفی).
        -   یادآوری اهمیت استراحت در صورت مشاهده تمرینات زیاد و پشت سر هم.
        -   پیشنهاد افزایش تدریجی وزنه (Progressive Overload) اگر وزنه‌ها ثابت به نظر می‌رسند.

    **قالب پاسخ:**
    -   لحن شما باید مثبت، دوستانه و تشویق کننده باشد.
    -   پاسخ را با یک عنوان بولد شده مانند **"تحلیل هوشمند تمرینات شما"** شروع کنید.
    -   از لیست‌های ستاره‌دار (* ) برای خوانایی بهتر پیشنهادات استفاده کنید.
    -   پاسخ کوتاه و مفید باشد (حدود ۱۵۰ کلمه).
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("AI User Insight Error:", error);
        showToast("خطا در تولید تحلیل هوشمند", "error");
        return null;
    }
};

export const analyzeExerciseForm = async (exerciseName: string, videoBase64: string, mimeType: string) => {
    const ai = getGenAI();
    const prompt = `
        You are an expert kinesiologist and fitness coach. Analyze the user's form for the exercise "${exerciseName}" based on the provided video. 
        Provide feedback in Persian. Your analysis must be structured and focus on safety and effectiveness.

        Key points to analyze:
        - Range of motion
        - Posture and spinal alignment
        - Joint angles (e.g., knees, elbows, shoulders)
        - Control and tempo of the movement
        - Common mistakes associated with this specific exercise

        Return the analysis in a JSON format with the following structure.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: videoBase64,
                        },
                    },
                ],
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        overallRating: {
                            type: Type.STRING,
                            description: "A single, overall rating in Persian (e.g., 'عالی', 'خوب', 'نیاز به بهبود')."
                        },
                        positivePoints: {
                            type: Type.ARRAY,
                            description: "An array of 2-3 specific, positive feedback points in Persian.",
                            items: { type: Type.STRING }
                        },
                        improvementPoints: {
                            type: Type.ARRAY,
                            description: "An array of 2-3 specific, actionable points for improvement in Persian.",
                            items: { type: Type.STRING }
                        },
                        summary: {
                            type: Type.STRING,
                            description: "A short, encouraging summary of the analysis in Persian."
                        }
                    }
                }
            }
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("AI Form Analysis Error:", error);
        showToast("خطا در تحلیل ویدیو با هوش مصنوعی", "error");
        return null;
    }
};