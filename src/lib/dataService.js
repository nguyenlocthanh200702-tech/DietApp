import { supabase } from './supabase';

function profileRowToUserData(row) {
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

function userDataToUserProfileRow(userId, timezoneKey, userData) {
  return {
    user_id: userId,
    timezone_key: timezoneKey,
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

function userDataToLegacyProfileRow(userId, userData) {
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

function mealRowToMeal(row) {
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

async function usesUserProfilesTable() {
  const { error } = await supabase.from('user_profiles').select('id').limit(1);
  return !error;
}

export async function fetchProfileSummaries(userId) {
  if (await usesUserProfilesTable()) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('timezone_key, name')
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []).map(row => ({
      timezoneKey: row.timezone_key,
      name: row.name
    }));
  }

  const legacy = await fetchLegacyProfile(userId);
  if (legacy) {
    return [{ timezoneKey: 'local', name: legacy.name }];
  }
  return [];
}

export async function fetchLegacyProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return profileRowToUserData(data);
}

export async function fetchProfile(userId, timezoneKey = 'local') {
  if (await usesUserProfilesTable()) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('timezone_key', timezoneKey)
      .maybeSingle();

    if (error) throw error;
    return profileRowToUserData(data);
  }

  if (timezoneKey === 'local') {
    return fetchLegacyProfile(userId);
  }
  return null;
}

export async function saveProfile(userId, timezoneKey, userData) {
  if (await usesUserProfilesTable()) {
    const row = userDataToUserProfileRow(userId, timezoneKey, userData);
    const { error } = await supabase
      .from('user_profiles')
      .upsert(row, { onConflict: 'user_id,timezone_key' });
    if (error) throw error;
    return;
  }

  if (timezoneKey === 'local') {
    const row = userDataToLegacyProfileRow(userId, userData);
    const { error } = await supabase.from('profiles').upsert(row);
    if (error) throw error;
  }
}

export async function deleteProfile(userId, timezoneKey) {
  if (await usesUserProfilesTable()) {
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('user_id', userId)
      .eq('timezone_key', timezoneKey);
    if (error) throw error;
    return;
  }

  if (timezoneKey === 'local') {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw error;
  }
}

export async function fetchMeals(userId, timezoneKey = 'local') {
  let query = supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false });

  if (await usesUserProfilesTable()) {
    query = query.eq('timezone_key', timezoneKey);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mealRowToMeal);
}

export async function insertMeal(userId, timezoneKey, meal) {
  const payload = {
    user_id: userId,
    logged_at: meal.timestamp,
    description: meal.description,
    meal_name: meal.mealName || 'Meal',
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat
  };

  if (await usesUserProfilesTable()) {
    payload.timezone_key = timezoneKey;
  }

  const { data, error } = await supabase.from('meals').insert(payload).select().single();
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

export async function fetchWaterTracker(userId, timezoneKey = 'local') {
  let query = supabase
    .from('water_logs')
    .select('log_date, amount_ml')
    .eq('user_id', userId);

  if (await usesUserProfilesTable()) {
    query = query.eq('timezone_key', timezoneKey);
  }

  const { data, error } = await query;
  if (error) throw error;

  const tracker = {};
  (data || []).forEach(row => {
    tracker[row.log_date] = row.amount_ml;
  });
  return tracker;
}

export async function upsertWaterLog(userId, timezoneKey, date, amountMl) {
  const row = {
    user_id: userId,
    log_date: date,
    amount_ml: amountMl
  };

  if (await usesUserProfilesTable()) {
    row.timezone_key = timezoneKey;
    const { error } = await supabase
      .from('water_logs')
      .upsert(row, { onConflict: 'user_id,timezone_key,log_date' });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('water_logs')
    .upsert(row, { onConflict: 'user_id,log_date' });
  if (error) throw error;
}

export async function deleteAllMeals(userId, timezoneKey) {
  let query = supabase.from('meals').delete().eq('user_id', userId);
  if (await usesUserProfilesTable()) {
    query = query.eq('timezone_key', timezoneKey);
  }
  const { error } = await query;
  if (error) throw error;
}

export async function deleteAllWaterLogs(userId, timezoneKey) {
  let query = supabase.from('water_logs').delete().eq('user_id', userId);
  if (await usesUserProfilesTable()) {
    query = query.eq('timezone_key', timezoneKey);
  }
  const { error } = await query;
  if (error) throw error;
}

export async function importLocalStorageData(userId, timezoneKey = 'local') {
  const savedProfile = localStorage.getItem('forgeUserData');
  const savedMeals = localStorage.getItem('forgeMeals');
  const savedWater = localStorage.getItem('forgeWaterTracker');

  if (savedProfile) {
    const userData = JSON.parse(savedProfile);
    await saveProfile(userId, timezoneKey, userData);
  }

  if (savedMeals) {
    const meals = JSON.parse(savedMeals);
    for (const meal of meals) {
      await insertMeal(userId, timezoneKey, meal);
    }
  }

  if (savedWater) {
    const tracker = JSON.parse(savedWater);
    for (const [date, amount] of Object.entries(tracker)) {
      await upsertWaterLog(userId, timezoneKey, date, amount);
    }
  }

  if (savedProfile || savedMeals || savedWater) {
    localStorage.removeItem('forgeUserData');
    localStorage.removeItem('forgeMeals');
    localStorage.removeItem('forgeWaterTracker');
    localStorage.removeItem('forgeProfileData');
  }
}
