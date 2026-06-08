import { supabase } from './supabase';

export function profileRowToUserData(row) {
  if (!row) return null;
  return {
    name: row.name,
    weight: Number(row.weight),
    height: Number(row.height),
    age: row.age,
    goal: row.goal,
    activityLevel: row.activity_level,
    dietaryRestrictions: row.dietary_restrictions || '',
    macroTargets: {
      calories: row.macro_calories,
      protein: row.macro_protein,
      carbs: row.macro_carbs,
      fat: row.macro_fat
    },
    waterGoal: row.water_goal,
    bottleSize: row.bottle_size,
    createdAt: row.created_at
  };
}

export function userDataToProfileRow(userId, userData) {
  return {
    id: userId,
    name: userData.name,
    weight: userData.weight,
    height: userData.height,
    age: userData.age,
    goal: userData.goal,
    activity_level: userData.activityLevel,
    dietary_restrictions: userData.dietaryRestrictions || null,
    macro_calories: userData.macroTargets.calories,
    macro_protein: userData.macroTargets.protein,
    macro_carbs: userData.macroTargets.carbs,
    macro_fat: userData.macroTargets.fat,
    water_goal: userData.waterGoal ?? 2000,
    bottle_size: userData.bottleSize ?? 2000
  };
}

export function mealRowToMeal(row) {
  return {
    id: row.id,
    timestamp: row.logged_at,
    description: row.description,
    mealName: row.meal_name,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat
  };
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return profileRowToUserData(data);
}

export async function saveProfile(userId, userData) {
  const row = userDataToProfileRow(userId, userData);
  const { error } = await supabase.from('profiles').upsert(row);
  if (error) throw error;
}

export async function deleteProfile(userId) {
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  if (error) throw error;
}

export async function fetchMeals(userId) {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mealRowToMeal);
}

export async function insertMeal(userId, meal) {
  const { data, error } = await supabase
    .from('meals')
    .insert({
      user_id: userId,
      logged_at: meal.timestamp,
      description: meal.description,
      meal_name: meal.mealName || 'Meal',
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat
    })
    .select()
    .single();

  if (error) throw error;
  return mealRowToMeal(data);
}

export async function updateMeal(userId, meal) {
  const { data, error } = await supabase
    .from('meals')
    .update({
      description: meal.description,
      meal_name: meal.mealName || 'Meal',
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat
    })
    .eq('id', meal.id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return mealRowToMeal(data);
}

export async function deleteMeal(userId, mealId) {
  const { error } = await supabase
    .from('meals')
    .delete()
    .eq('id', mealId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function fetchWaterTracker(userId) {
  const { data, error } = await supabase
    .from('water_logs')
    .select('log_date, amount_ml')
    .eq('user_id', userId);

  if (error) throw error;

  const tracker = {};
  (data || []).forEach(row => {
    tracker[row.log_date] = row.amount_ml;
  });
  return tracker;
}

export async function upsertWaterLog(userId, date, amountMl) {
  const { error } = await supabase
    .from('water_logs')
    .upsert(
      { user_id: userId, log_date: date, amount_ml: amountMl },
      { onConflict: 'user_id,log_date' }
    );

  if (error) throw error;
}

export async function deleteAllMeals(userId) {
  const { error } = await supabase.from('meals').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function deleteAllWaterLogs(userId) {
  const { error } = await supabase.from('water_logs').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function importLocalStorageData(userId) {
  const savedProfile = localStorage.getItem('forgeUserData');
  const savedMeals = localStorage.getItem('forgeMeals');
  const savedWater = localStorage.getItem('forgeWaterTracker');

  if (savedProfile) {
    const userData = JSON.parse(savedProfile);
    await saveProfile(userId, userData);
  }

  if (savedMeals) {
    const meals = JSON.parse(savedMeals);
    for (const meal of meals) {
      await insertMeal(userId, meal);
    }
  }

  if (savedWater) {
    const tracker = JSON.parse(savedWater);
    for (const [date, amount] of Object.entries(tracker)) {
      await upsertWaterLog(userId, date, amount);
    }
  }

  if (savedProfile || savedMeals || savedWater) {
    localStorage.removeItem('forgeUserData');
    localStorage.removeItem('forgeMeals');
    localStorage.removeItem('forgeWaterTracker');
    localStorage.removeItem('forgeProfileData');
  }
}
