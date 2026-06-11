import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import AuthScreen from './components/AuthScreen';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { getDisplayUsername } from './lib/authHelpers';
import {
  getTodayKey,
  getMealDateKey,
  isTodayInAppTz,
  getLastNDaysKeys,
  getCurrentWeekKeys,
  getWeekdayLabel,
  isWithinLastDaysInAppTz
} from './lib/dateUtils';
import {
  fetchProfile,
  saveProfile,
  deleteProfile,
  fetchMeals,
  insertMeal,
  updateMeal as updateMealInDb,
  deleteMeal as deleteMealFromDb,
  fetchWaterTracker,
  upsertWaterLog,
  deleteAllMeals,
  deleteAllWaterLogs,
  importLocalStorageData
} from './lib/dataService';

const SCREEN_SAFE_TOP = 'calc(env(safe-area-inset-top, 0px) + 52px)';

const backNavButtonStyle = {
  background: 'none',
  border: 'none',
  color: '#00d9ff',
  cursor: 'pointer',
  fontSize: '14px',
  marginBottom: '24px',
  marginTop: '8px',
  fontWeight: 600,
  padding: '8px 0'
};

const subScreenWrapStyle = {
  minHeight: '100vh',
  background: '#0f0f0f',
  color: '#fff',
  padding: '20px',
  paddingTop: SCREEN_SAFE_TOP,
  fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  paddingBottom: '100px'
};

const ForgeApp = () => {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [screen, setScreen] = useState('onboarding'); // onboarding, onboarding-macros, dashboard, log-meal, coach, progress, settings
  const [onboardingStep, setOnboardingStep] = useState(1); // 1: profile, 2: macro choice, 3: manual macros
  const [onboardingProfile, setOnboardingProfile] = useState(null);
  const [userData, setUserData] = useState(null);
  const [meals, setMeals] = useState([]);
  const [mealInput, setMealInput] = useState('');
  const [logMealMode, setLogMealMode] = useState('ai'); // 'ai' | 'manual'
  const [manualMeal, setManualMeal] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: ''
  });
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachAdvice, setCoachAdvice] = useState('');
  const [editingMealId, setEditingMealId] = useState(null);
  const [editingMealInput, setEditingMealInput] = useState('');
  const [waterTracker, setWaterTracker] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [currentDayKey, setCurrentDayKey] = useState(() => getTodayKey());
  const [progressPeriod, setProgressPeriod] = useState('month'); // 'week' | 'month'

  // Re-render when the calendar day changes in UTC+7 (midnight Bangkok/Hanoi/Jakarta)
  useEffect(() => {
    const syncDay = () => {
      const today = getTodayKey();
      setCurrentDayKey(prev => (prev !== today ? today : prev));
    };

    syncDay();
    const interval = setInterval(syncDay, 60 * 1000);
    window.addEventListener('focus', syncDay);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', syncDay);
    };
  }, []);

  const loadUserData = async (userId) => {
    setDataLoading(true);
    try {
      let profile = await fetchProfile(userId);

      if (!profile && (localStorage.getItem('forgeUserData') || localStorage.getItem('forgeMeals'))) {
        await importLocalStorageData(userId);
        profile = await fetchProfile(userId);
      }

      const [mealsData, waterData] = await Promise.all([
        fetchMeals(userId),
        fetchWaterTracker(userId)
      ]);

      setMeals(mealsData);
      setWaterTracker(waterData);

      if (profile) {
        setUserData(profile);
        setScreen('dashboard');
      } else {
        setUserData(null);
        setOnboardingStep(1);
        setScreen('onboarding');
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
      alert('Failed to load your data. Please refresh and try again.');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authUser) {
      loadUserData(authUser.id);
    } else if (!authLoading) {
      setUserData(null);
      setMeals([]);
      setWaterTracker({});
    }
  }, [authUser, authLoading]);

  // Calculate macro targets based on user data
  const calculateMacroTargets = (weight, height, age, goal, activityLevel) => {
    // Mifflin-St Jeor for BMR
    let bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    
    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      intense: 1.725
    };
    
    const tdee = bmr * activityMultipliers[activityLevel];
    
    // Calorie adjustment by goal
    let targetCalories = tdee;
    if (goal === 'lose-fat') targetCalories = tdee - 500;
    if (goal === 'build-muscle') targetCalories = tdee + 300;
    
    // Macro distribution
    let protein = weight * 2.2; // 2.2g per kg for muscle building
    if (goal === 'lose-fat') protein = weight * 2.0;
    
    let fat = (targetCalories * 0.25) / 9; // 25% of calories
    let carbs = (targetCalories - (protein * 4) - (fat * 9)) / 4;
    
    return {
      calories: Math.round(targetCalories),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat)
    };
  };





  // Call backend API for meal estimation
  const estimateMealMacros = async (mealDescription) => {
    try {
      // Use your Vercel backend URL here (you'll get it after deploying)
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://your-vercel-function.vercel.app';
      
      const response = await fetch(`${backendUrl}/api/estimate-macros`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mealDescription: mealDescription
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const macros = await response.json();
      return macros;
    } catch (error) {
      console.error('Error estimating macros:', error);
      alert('Failed to estimate macros. Check your internet connection and try again.');
      return null;
    }
  };

  const addMeal = async (meal) => {
    if (!authUser) return;
    try {
      const saved = await insertMeal(authUser.id, meal);
      setMeals(prev => [saved, ...prev]);
    } catch (error) {
      console.error('Failed to save meal:', error);
      alert('Failed to save meal. Please try again.');
    }
  };

  const completeOnboarding = async (profileData) => {
    if (!authUser) return;
    try {
      await saveProfile(authUser.id, profileData);
      setUserData(profileData);
      setOnboardingProfile(null);
      setOnboardingStep(1);
      setScreen('dashboard');
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Failed to save your profile. Please try again.');
    }
  };

  // Handle meal logging via AI estimation
  const handleLogMeal = async (e) => {
    e.preventDefault();
    if (!mealInput.trim()) return;

    const macros = await estimateMealMacros(mealInput);
    
    if (macros) {
    addMeal({
      timestamp: new Date().toISOString(),
      description: mealInput,
        mealName: macros.mealName || 'Meal',
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat
      });
      
      setMealInput('');
    }
  };

  const handleLogManualMeal = (e) => {
    e.preventDefault();

    const name = manualMeal.name.trim();
    const calories = parseInt(manualMeal.calories, 10);
    const protein = parseInt(manualMeal.protein, 10);
    const carbs = parseInt(manualMeal.carbs, 10);
    const fat = parseInt(manualMeal.fat, 10);

    if (!name) return;
    if ([calories, protein, carbs, fat].some(v => isNaN(v) || v < 0)) {
      alert('Please enter valid macro values (0 or greater).');
      return;
    }

    addMeal({
      timestamp: new Date().toISOString(),
      description: name,
      mealName: name,
      calories,
      protein,
      carbs,
      fat
    });

    setManualMeal({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  };

  // Get today's water intake (resets at midnight UTC+7)
  const getTodayWaterIntake = () => {
    return waterTracker[currentDayKey] || 0;
  };

  // Get today's totals (resets at midnight UTC+7)
  const getTodayTotals = () => {
    const todayMeals = meals.filter(m => isTodayInAppTz(m.timestamp));
    
    return {
      calories: todayMeals.reduce((sum, m) => sum + m.calories, 0),
      protein: todayMeals.reduce((sum, m) => sum + m.protein, 0),
      carbs: todayMeals.reduce((sum, m) => sum + m.carbs, 0),
      fat: todayMeals.reduce((sum, m) => sum + m.fat, 0)
    };
  };

  // Delete a meal
  const deleteMeal = async (mealId) => {
    if (!authUser) return;
    try {
      await deleteMealFromDb(authUser.id, mealId);
      setMeals(meals.filter(m => m.id !== mealId));
    } catch (error) {
      console.error('Failed to delete meal:', error);
      alert('Failed to delete meal. Please try again.');
    }
  };

  // Start editing a meal
  const startEditingMeal = (meal) => {
    setEditingMealId(meal.id);
    setEditingMealInput(meal.description);
  };

  // Cancel editing
  const cancelEditMeal = () => {
    setEditingMealId(null);
    setEditingMealInput('');
  };

  // Save edited meal
  const saveEditedMeal = async (mealId) => {
    if (!editingMealInput.trim()) return;

    // Re-estimate macros for the new description
    const macros = await estimateMealMacros(editingMealInput);
    
    if (macros && authUser) {
      const existing = meals.find(m => m.id === mealId);
      if (!existing) return;

      const updated = {
        ...existing,
        description: editingMealInput,
        mealName: macros.mealName || 'Meal',
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat
      };

      try {
        const saved = await updateMealInDb(authUser.id, updated);
        setMeals(meals.map(m => m.id === mealId ? saved : m));
        setEditingMealId(null);
        setEditingMealInput('');
      } catch (error) {
        console.error('Failed to update meal:', error);
        alert('Failed to update meal. Please try again.');
      }
    }
  };

  const buildCoachMealContext = (macroTargets) => {
    const recentMeals = meals.filter(m => isWithinLastDaysInAppTz(m.timestamp, 7));
    if (recentMeals.length === 0) {
      return 'No meals logged in the last 7 days.';
    }

    const today = currentDayKey;
    const dailyMeals = {};
    const dailyTotals = {};

    recentMeals.forEach(meal => {
      const date = getMealDateKey(meal.timestamp);
      if (!dailyMeals[date]) dailyMeals[date] = [];
      if (!dailyTotals[date]) dailyTotals[date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };

      dailyMeals[date].push(meal);
      dailyTotals[date].calories += meal.calories || 0;
      dailyTotals[date].protein += meal.protein || 0;
      dailyTotals[date].carbs += meal.carbs || 0;
      dailyTotals[date].fat += meal.fat || 0;
    });

    const lines = ['LOGGED MEALS (last 7 days):'];

    Object.keys(dailyMeals).sort().forEach(date => {
      lines.push(`\n${date}:`);
      dailyMeals[date].forEach(meal => {
        const label = meal.mealName || 'Meal';
        const desc = meal.description ? ` — ${meal.description}` : '';
        lines.push(`  - ${label}${desc}: ${meal.calories || 0} cal, ${meal.protein || 0}g protein, ${meal.carbs || 0}g carbs, ${meal.fat || 0}g fat`);
      });
      const totals = dailyTotals[date];
      lines.push(`  Daily total: ${totals.calories} cal, ${totals.protein}g protein, ${totals.carbs}g carbs, ${totals.fat}g fat`);
    });

    if (macroTargets) {
      const todayTotals = dailyTotals[today] || { calories: 0, protein: 0, carbs: 0, fat: 0 };
      lines.push('\nTODAY vs DAILY TARGETS:');
      lines.push(`  Calories: ${todayTotals.calories}/${macroTargets.calories}`);
      lines.push(`  Protein: ${todayTotals.protein}g/${macroTargets.protein}g`);
      lines.push(`  Carbs: ${todayTotals.carbs}g/${macroTargets.carbs}g`);
      lines.push(`  Fat: ${todayTotals.fat}g/${macroTargets.fat}g`);
    }

    return lines.join('\n');
  };

  // Call backend for coaching advice
  const generateCoachAdvice = async () => {
    setCoachLoading(true);

    const mealSummary = buildCoachMealContext(userData?.macroTargets);

    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://your-vercel-function.vercel.app';
      
      const response = await fetch(`${backendUrl}/api/get-coaching`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Analyze my logged meals below and give me a brief personalized nutrition analysis with 2-3 actionable tips. Use only this data — do not ask me to provide meals.\n\n${mealSummary}`
          }],
          userProfile: {
            name: userData.name,
            goal: userData.goal,
            weight: userData.weight,
            macroTargets: userData.macroTargets,
            dietaryRestrictions: userData.dietaryRestrictions
          },
          mealSummary
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setCoachAdvice(data.reply);
    } catch (error) {
      console.error('Error getting coach advice:', error);
      setCoachAdvice('Unable to get advice right now. Keep logging your meals!');
    }
    
    setCoachLoading(false);
  };

  // Get progress chart data (last 30 days)
  // Send a chat message to the AI coach
  const sendChatMessage = async (userMessage) => {
    if (!userMessage.trim()) return;

    const newUserMsg = { role: 'user', content: userMessage };
    const updatedMessages = [...chatMessages, newUserMsg];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);

    const mealSummary = buildCoachMealContext(userData?.macroTargets);

    // Build conversation history for context
    const conversationHistory = updatedMessages.map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://your-vercel-function.vercel.app';
      const response = await fetch(`${backendUrl}/api/get-coaching`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory,
          userProfile: {
            name: userData.name,
            goal: userData.goal,
            weight: userData.weight,
            macroTargets: userData.macroTargets,
            dietaryRestrictions: userData.dietaryRestrictions
          },
          mealSummary
        })
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();

      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting right now. Try again in a moment!" }]);
    }

    setChatLoading(false);
  };

  const buildProgressData = (dateKeys, labelForKey = (key) => key) => {
    const data = {};

    dateKeys.forEach(dateStr => {
      data[dateStr] = {
        date: labelForKey(dateStr),
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        target: userData?.macroTargets.calories || 0,
        proteinTarget: userData?.macroTargets.protein || 0,
        water: waterTracker[dateStr] || 0,
        waterTarget: userData?.waterGoal || 2000
      };
    });

    meals.forEach(meal => {
      const dateStr = getMealDateKey(meal.timestamp);
      if (data[dateStr]) {
        data[dateStr].calories += meal.calories;
        data[dateStr].protein += meal.protein;
        data[dateStr].carbs += meal.carbs;
        data[dateStr].fat += meal.fat;
      }
    });

    return dateKeys.map(key => data[key]);
  };

  const getMonthlyProgressData = () => buildProgressData(getLastNDaysKeys(30));

  const getWeeklyProgressData = () => buildProgressData(getCurrentWeekKeys(), getWeekdayLabel);

  const todayTotals = getTodayTotals();

  // Macro ring component (responsive)
  const MacroRing = ({ label, current, target, color }) => {
    const percentage = Math.min((current / target) * 100, 100);
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    const svgSize = 90;
    const svgCenter = svgSize / 2;
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <svg width={svgSize} height={svgSize} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={svgCenter} cy={svgCenter} r={radius} fill="none" stroke="#333" strokeWidth="6" />
          <circle
            cx={svgCenter}
            cy={svgCenter}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
            {label}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginTop: '3px' }}>
            {Math.round(current)} / {target}
          </div>
        </div>
      </div>
    );
  };

  const loadingScreen = (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f0f',
      color: '#999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
    }}>
      Loading...
    </div>
  );

  if (!isSupabaseConfigured) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0f0f0f',
        color: '#fff',
        padding: '40px 20px',
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ maxWidth: '480px', textAlign: 'center' }}>
          <h1 style={{ color: '#00d9ff', marginBottom: '12px' }}>Supabase not configured</h1>
          <p style={{ color: '#999', lineHeight: 1.6 }}>
            Add <code style={{ color: '#fff' }}>REACT_APP_SUPABASE_URL</code> and{' '}
            <code style={{ color: '#fff' }}>REACT_APP_SUPABASE_ANON_KEY</code> to your <code style={{ color: '#fff' }}>.env</code> file,
            then run the SQL in <code style={{ color: '#fff' }}>supabase/schema.sql</code> in your Supabase project.
          </p>
        </div>
      </div>
    );
  }

  if (authLoading || (authUser && dataLoading)) {
    return loadingScreen;
  }

  if (!authUser) {
    return <AuthScreen />;
  }

  // Screens
  if (screen === 'onboarding') {
    // Step 1: Profile Information
    if (onboardingStep === 1) {
      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
          color: '#fff',
          padding: '20px',
          fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ maxWidth: '400px', width: '100%' }}>
            <div style={{ marginBottom: '40px', textAlign: 'center' }}>
              <h1 style={{ fontSize: '36px', margin: 0, fontWeight: 700, color: '#00d9ff', marginBottom: '8px' }}>FORGE</h1>
              <p style={{ fontSize: '14px', color: '#999', margin: 0 }}>Your AI fitness diet coach</p>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              setOnboardingProfile({
                name: formData.get('name'),
                weight: parseFloat(formData.get('weight')),
                height: parseFloat(formData.get('height')),
                age: parseInt(formData.get('age')),
                goal: formData.get('goal'),
                activityLevel: formData.get('activity'),
                dietaryRestrictions: formData.get('restrictions'),
              });
              setOnboardingStep(2);
            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#00d9ff', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#222',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#00d9ff', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    name="weight"
                    required
                    step="0.1"
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#222',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#00d9ff', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    name="height"
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#222',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#00d9ff', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Age
                </label>
                <input
                  type="number"
                  name="age"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#222',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#00d9ff', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Goal
                </label>
                <select
                  name="goal"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#222',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Select your goal</option>
                  <option value="build-muscle">Build muscle</option>
                  <option value="lose-fat">Lose fat</option>
                  <option value="maintain">Maintain</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#00d9ff', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Activity Level
                </label>
                <select
                  name="activity"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#222',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Select activity level</option>
                  <option value="sedentary">Sedentary (little exercise)</option>
                  <option value="light">Light (1-3 days/week)</option>
                  <option value="moderate">Moderate (3-5 days/week)</option>
                  <option value="intense">Intense (6-7 days/week)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#00d9ff', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Dietary Restrictions (optional)
                </label>
                <input
                  type="text"
                  name="restrictions"
                  placeholder="e.g., vegetarian, gluten-free"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#222',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  padding: '14px',
                  background: '#00d9ff',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#00b8d4'}
                onMouseLeave={(e) => e.target.style.background = '#00d9ff'}
              >
                Next: Set Macros
              </button>
            </form>
          </div>
        </div>
      );
    }

    // Step 2: Macro Setup Mode Choice
    if (onboardingStep === 2) {
      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
          color: '#fff',
          padding: '20px',
          fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ maxWidth: '400px', width: '100%' }}>
            <div style={{ marginBottom: '40px', textAlign: 'center' }}>
              <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 700, marginBottom: '8px' }}>Set Your Macros</h1>
              <p style={{ fontSize: '14px', color: '#999', margin: 0 }}>How would you like to set your daily targets?</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Auto Calculate Option */}
              <div
                onClick={() => {
                  const macroTargets = calculateMacroTargets(
                    onboardingProfile.weight,
                    onboardingProfile.height,
                    onboardingProfile.age,
                    onboardingProfile.goal,
                    onboardingProfile.activityLevel
                  );
                  
                  setUserData({
                    ...onboardingProfile,
                    macroTargets,
                    createdAt: new Date().toISOString()
                  });
                  setOnboardingStep(4);
                }}
                style={{
                  padding: '20px',
                  background: '#1a1a1a',
                  border: '2px solid #00d9ff',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#222';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1a1a1a';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <h3 style={{ fontSize: '16px', margin: '0 0 8px', fontWeight: 700, color: '#00d9ff' }}>
                  Auto Calculate
                </h3>
                <p style={{ fontSize: '13px', color: '#999', margin: 0, lineHeight: '1.5' }}>
                  I'll calculate your targets based on your weight, height, age, goal, and activity level using fitness formulas.
                </p>
              </div>

              {/* Custom Input Option */}
              <div
                onClick={() => setOnboardingStep(3)}
                style={{
                  padding: '20px',
                  background: '#1a1a1a',
                  border: '2px solid #00ff88',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#222';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1a1a1a';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <h3 style={{ fontSize: '16px', margin: '0 0 8px', fontWeight: 700, color: '#00ff88' }}>
                  Custom Input
                </h3>
                <p style={{ fontSize: '13px', color: '#999', margin: 0, lineHeight: '1.5' }}>
                  I already have my macro targets. Let me enter them manually.
                </p>
              </div>
            </div>

            <button
              onClick={() => setOnboardingStep(1)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'transparent',
                color: '#999',
                border: '1px solid #333',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '12px',
                marginTop: '24px'
              }}
            >
              ← Back
            </button>
          </div>
        </div>
      );
    }

    // Step 3: Custom Macro Input
    if (onboardingStep === 3) {
      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
          color: '#fff',
          padding: '20px',
          fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ maxWidth: '400px', width: '100%' }}>
            <div style={{ marginBottom: '40px', textAlign: 'center' }}>
              <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 700, marginBottom: '8px' }}>Enter Your Targets</h1>
              <p style={{ fontSize: '14px', color: '#999', margin: 0 }}>Daily macro goals</p>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              setUserData({
                ...onboardingProfile,
                macroTargets: {
                  calories: parseInt(formData.get('calories')),
                  protein: parseInt(formData.get('protein')),
                  carbs: parseInt(formData.get('carbs')),
                  fat: parseInt(formData.get('fat'))
                },
                createdAt: new Date().toISOString()
              });
              setOnboardingStep(4);
            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#ffa500', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Daily Calories
                </label>
                <input
                  type="number"
                  name="calories"
                  required
                  min="1200"
                  max="10000"
                  placeholder="e.g., 2500"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#222',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#00d9ff', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Daily Protein (g)
                </label>
                <input
                  type="number"
                  name="protein"
                  required
                  min="20"
                  max="500"
                  placeholder="e.g., 150"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#222',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#00ff88', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Daily Carbs (g)
                </label>
                <input
                  type="number"
                  name="carbs"
                  required
                  min="20"
                  max="500"
                  placeholder="e.g., 250"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#222',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#ff6b6b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Daily Fat (g)
                </label>
                <input
                  type="number"
                  name="fat"
                  required
                  min="10"
                  max="300"
                  placeholder="e.g., 80"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#222',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  padding: '14px',
                  background: '#00d9ff',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#00b8d4'}
                onMouseLeave={(e) => e.target.style.background = '#00d9ff'}
              >
                Start Training
              </button>
            </form>

            <button
              onClick={() => setOnboardingStep(2)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'transparent',
                color: '#999',
                border: '1px solid #333',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '12px',
                marginTop: '12px'
              }}
            >
              ← Back
            </button>
          </div>
        </div>
      );
    }

    // Step 4: Water Goal Setup
    if (onboardingStep === 4) {
      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
          color: '#fff',
          padding: '20px',
          fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ maxWidth: '400px', width: '100%' }}>
            <div style={{ marginBottom: '40px', textAlign: 'center' }}>
              <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 700, marginBottom: '8px' }}>Water Goal</h1>
              <p style={{ fontSize: '14px', color: '#999', margin: 0 }}>Stay hydrated during your fitness journey</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Auto Calculate Option */}
              <div
                onClick={() => {
                  const waterGoal = Math.round((userData.weight || 70) * 35 / 100) * 100;
                  completeOnboarding({
                    ...userData,
                    waterGoal: Math.max(waterGoal, 2000),
                    bottleSize: 2000
                  });
                }}
                style={{
                  padding: '20px',
                  background: '#1a1a1a',
                  border: '2px solid #00d9ff',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#222';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1a1a1a';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <h3 style={{ fontSize: '16px', margin: '0 0 8px', fontWeight: 700, color: '#00d9ff' }}>
                  Auto Calculate
                </h3>
                <p style={{ fontSize: '13px', color: '#999', margin: 0, lineHeight: '1.5' }}>
                  Calculates based on your body weight (~35ml per kg). Minimum 2000ml/day.
                </p>
              </div>

              {/* Custom Input Option */}
              <div
                onClick={() => setOnboardingStep(5)}
                style={{
                  padding: '20px',
                  background: '#1a1a1a',
                  border: '2px solid #00ff88',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#222';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1a1a1a';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <h3 style={{ fontSize: '16px', margin: '0 0 8px', fontWeight: 700, color: '#00ff88' }}>
                  Custom Input
                </h3>
                <p style={{ fontSize: '13px', color: '#999', margin: 0, lineHeight: '1.5' }}>
                  Set your own water goal and bottle size
                </p>
              </div>
            </div>

            <button
              onClick={() => setOnboardingStep(3)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'transparent',
                color: '#999',
                border: '1px solid #333',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '12px',
                marginTop: '24px'
              }}
            >
              ← Back
            </button>
          </div>
        </div>
      );
    }

    // Step 5: Custom Water Goal
    if (onboardingStep === 5) {
      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
          color: '#fff',
          padding: '20px',
          fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ maxWidth: '400px', width: '100%' }}>
            <div style={{ marginBottom: '40px', textAlign: 'center' }}>
              <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 700, marginBottom: '8px' }}>Set Water Goal</h1>
              <p style={{ fontSize: '14px', color: '#999', margin: 0 }}>Daily water target (ml)</p>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              completeOnboarding({
                ...userData,
                waterGoal: parseInt(formData.get('waterGoal')),
                bottleSize: parseInt(formData.get('bottleSize'))
              });
            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#4fc3f7', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Daily Water Goal (ml)
                </label>
                <input
                  type="number"
                  name="waterGoal"
                  required
                  min="500"
                  max="10000"
                  step="100"
                  defaultValue="2000"
                  placeholder="e.g., 2000"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#222',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#4fc3f7', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Bottle Size (ml)
                </label>
                <select
                  name="bottleSize"
                  required
                  defaultValue="2000"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#222',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="250">250ml (small glass)</option>
                  <option value="500">500ml (standard bottle)</option>
                  <option value="750">750ml (medium bottle)</option>
                  <option value="1000">1000ml (1L bottle)</option>
                  <option value="1500">1500ml (1.5L bottle)</option>
                  <option value="2000">2000ml (2L bottle)</option>
                </select>
              </div>

              <button
                type="submit"
                style={{
                  padding: '14px',
                  background: '#4fc3f7',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#29b6f6'}
                onMouseLeave={(e) => e.target.style.background = '#4fc3f7'}
              >
                Start Training
              </button>
            </form>

            <button
              onClick={() => setOnboardingStep(4)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'transparent',
                color: '#999',
                border: '1px solid #333',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '12px',
                marginTop: '12px'
              }}
            >
              ← Back
            </button>
          </div>
        </div>
      );
    }
  }

  // Dashboard
  if (screen === 'dashboard') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0f0f0f',
        color: '#fff',
        padding: '20px',
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
        paddingBottom: '100px'
      }}>
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '32px' }}>
            <p style={{ fontSize: '12px', color: '#999', margin: '0 0 8px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 700 }}>Welcome back, {userData?.name}</h1>
          </div>

          {/* Macro Rings */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
            gap: '10px', 
            marginBottom: '40px',
            maxWidth: '100%'
          }}>
            <MacroRing label="Protein" current={todayTotals.protein} target={userData?.macroTargets.protein || 150} color="#00d9ff" />
            <MacroRing label="Carbs" current={todayTotals.carbs} target={userData?.macroTargets.carbs || 250} color="#00ff88" />
            <MacroRing label="Fat" current={todayTotals.fat} target={userData?.macroTargets.fat || 80} color="#ff6b6b" />
            <MacroRing label="Calories" current={todayTotals.calories} target={userData?.macroTargets.calories || 2500} color="#ffa500" />
          </div>

          {/* Water Tracker */}
          {(() => {
            const waterGoal = userData?.waterGoal || 2000;
            const waterIntake = getTodayWaterIntake();
            const waterPercent = Math.min((waterIntake / waterGoal) * 100, 100);
            const marks = [];
            const step = 500;
            for (let i = step; i < waterGoal; i += step) {
              marks.push(i);
            }

            return (
              <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#4fc3f7' }}>
                    💧 Water
                  </h2>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: waterIntake >= waterGoal ? '#00ff88' : '#4fc3f7' }}>
                    {waterIntake}ml / {waterGoal}ml
                  </span>
                </div>

                {/* Slider Track with marks */}
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  {/* Background Track */}
                  <div style={{
                    width: '100%',
                    height: '10px',
                    background: '#333',
                    borderRadius: '5px',
                    position: 'relative',
                    overflow: 'visible'
                  }}>
                    {/* Fill */}
                    <div style={{
                      width: `${waterPercent}%`,
                      height: '100%',
                      background: waterIntake >= waterGoal
                        ? 'linear-gradient(90deg, #4fc3f7, #00ff88)'
                        : 'linear-gradient(90deg, #1565c0, #4fc3f7)',
                      borderRadius: '5px',
                      transition: 'width 0.3s ease'
                    }} />

                    {/* Progress Marks */}
                    {marks.map(mark => {
                      const markPercent = (mark / waterGoal) * 100;
                      return (
                        <div
                          key={mark}
                          style={{
                            position: 'absolute',
                            left: `${markPercent}%`,
                            top: '-4px',
                            transform: 'translateX(-50%)',
                            width: '2px',
                            height: '18px',
                            background: waterIntake >= mark ? '#4fc3f7' : '#555',
                            borderRadius: '1px',
                            zIndex: 2
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Slider Input (invisible but interactive) */}
                  <input
                    type="range"
                    min="0"
                    max={waterGoal}
                    step="50"
                    value={waterIntake}
                    onChange={async (e) => {
                      const newVal = parseInt(e.target.value);
                      const today = currentDayKey;
                      const updated = { ...waterTracker, [today]: newVal };
                      setWaterTracker(updated);
                      if (authUser) {
                        try {
                          await upsertWaterLog(authUser.id, today, newVal);
                        } catch (error) {
                          console.error('Failed to save water intake:', error);
                        }
                      }
                    }}
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      left: 0,
                      width: '100%',
                      height: '18px',
                      opacity: 0,
                      cursor: 'pointer',
                      zIndex: 3,
                      margin: 0
                    }}
                  />
                </div>

                {/* Mark Labels */}
                <div style={{ position: 'relative', height: '18px' }}>
                  {marks.map(mark => {
                    const markPercent = (mark / waterGoal) * 100;
                    return (
                      <span
                        key={mark}
                        style={{
                          position: 'absolute',
                          left: `${markPercent}%`,
                          transform: 'translateX(-50%)',
                          fontSize: '10px',
                          color: waterIntake >= mark ? '#4fc3f7' : '#555',
                          fontWeight: 600,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {mark >= 1000 ? `${mark / 1000}L` : `${mark}`}
                      </span>
                    );
                  })}
                  <span style={{
                    position: 'absolute',
                    right: 0,
                    fontSize: '10px',
                    color: waterIntake >= waterGoal ? '#00ff88' : '#555',
                    fontWeight: 600
                  }}>
                    {waterGoal >= 1000 ? `${waterGoal / 1000}L` : `${waterGoal}`}
                  </span>
                </div>

                {/* Status message */}
                <p style={{
                  fontSize: '12px',
                  color: waterIntake >= waterGoal ? '#00ff88' : '#666',
                  margin: '10px 0 0',
                  textAlign: 'center'
                }}>
                  {waterIntake === 0
                    ? 'Slide to log your water intake'
                    : waterIntake >= waterGoal
                    ? '🎉 Daily water goal reached!'
                    : `${waterGoal - waterIntake}ml left to reach your goal`}
                </p>
              </div>
            );
          })()}

          {/* Today's Meals */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#00d9ff' }}>
              Today's meals
            </h2>
            
            {meals.filter(m => isTodayInAppTz(m.timestamp)).length === 0 ? (
              <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No meals logged yet today</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {meals.filter(m => isTodayInAppTz(m.timestamp)).map(meal => (
                  <div
                    key={meal.id}
                    style={{
                      background: editingMealId === meal.id ? '#222' : '#1a1a1a',
                      padding: '12px',
                      borderRadius: '6px',
                      border: editingMealId === meal.id ? '1px solid #00d9ff' : '1px solid #333',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    {editingMealId === meal.id ? (
                      // Edit Mode
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <textarea
                          value={editingMealInput}
                          onChange={(e) => setEditingMealInput(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            background: '#1a1a1a',
                            border: '1px solid #333',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '13px',
                            fontFamily: 'inherit',
                            minHeight: '60px',
                            boxSizing: 'border-box',
                            resize: 'vertical'
                          }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => saveEditedMeal(meal.id)}
                            style={{
                              flex: 1,
                              padding: '8px',
                              background: '#00d9ff',
                              color: '#000',
                              border: 'none',
                              borderRadius: '4px',
                              fontWeight: 600,
                              fontSize: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#00b8d4'}
                            onMouseLeave={(e) => e.target.style.background = '#00d9ff'}
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditMeal}
                            style={{
                              flex: 1,
                              padding: '8px',
                              background: '#333',
                              color: '#999',
                              border: '1px solid #444',
                              borderRadius: '4px',
                              fontWeight: 600,
                              fontSize: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.target.style.background = '#444'; e.target.style.color = '#fff'; }}
                            onMouseLeave={(e) => { e.target.style.background = '#333'; e.target.style.color = '#999'; }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <>
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>{meal.mealName}</p>
                          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#999' }}>
                            {meal.calories} cal • P: {meal.protein}g • C: {meal.carbs}g • F: {meal.fat}g
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => startEditingMeal(meal)}
                            style={{
                              flex: 1,
                              padding: '6px',
                              background: '#333',
                              color: '#00d9ff',
                              border: '1px solid #444',
                              borderRadius: '4px',
                              fontWeight: 600,
                              fontSize: '11px',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              textTransform: 'uppercase'
                            }}
                            onMouseEnter={(e) => { e.target.style.background = '#444'; }}
                            onMouseLeave={(e) => { e.target.style.background = '#333'; }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteMeal(meal.id)}
                            style={{
                              flex: 1,
                              padding: '6px',
                              background: '#333',
                              color: '#ff6b6b',
                              border: '1px solid #444',
                              borderRadius: '4px',
                              fontWeight: 600,
                              fontSize: '11px',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              textTransform: 'uppercase'
                            }}
                            onMouseEnter={(e) => { e.target.style.background = '#ff6b6b'; e.target.style.color = '#fff'; }}
                            onMouseLeave={(e) => { e.target.style.background = '#333'; e.target.style.color = '#ff6b6b'; }}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            <button
              onClick={() => setScreen('log-meal')}
              style={{
                padding: '12px',
                background: '#00d9ff',
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#00b8d4'}
              onMouseLeave={(e) => e.target.style.background = '#00d9ff'}
            >
              + Log Meal
            </button>
            <button
              onClick={() => { setChatMessages([]); generateCoachAdvice(); setScreen('coach'); }}
              style={{
                padding: '12px',
                background: '#333',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.target.style.background = '#444'; e.target.style.borderColor = '#555'; }}
              onMouseLeave={(e) => { e.target.style.background = '#333'; e.target.style.borderColor = '#444'; }}
            >
              AI Coach
            </button>
            <button
              onClick={() => setScreen('progress')}
              style={{
                padding: '12px',
                background: '#333',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.target.style.background = '#444'; e.target.style.borderColor = '#555'; }}
              onMouseLeave={(e) => { e.target.style.background = '#333'; e.target.style.borderColor = '#444'; }}
            >
              Progress
            </button>
          </div>

          <button
            onClick={() => setScreen('settings')}
            style={{
              width: '100%',
              padding: '12px',
              background: '#222',
              color: '#999',
              border: '1px solid #333',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Settings
          </button>
        </div>
      </div>
    );
  }

  // Log Meal
  if (screen === 'log-meal') {
    return (
      <div style={subScreenWrapStyle}>
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <button
            onClick={() => setScreen('dashboard')}
            style={backNavButtonStyle}
          >
            ← Back
          </button>

          <h1 style={{ fontSize: '24px', margin: '0 0 16px', fontWeight: 700 }}>Log a meal</h1>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {[
              { id: 'ai', label: 'AI Estimate' },
              { id: 'manual', label: 'Enter Macros' }
            ].map(mode => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setLogMealMode(mode.id)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: logMealMode === mode.id ? '#00d9ff' : '#1a1a1a',
                  color: logMealMode === mode.id ? '#000' : '#999',
                  border: `1px solid ${logMealMode === mode.id ? '#00d9ff' : '#333'}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {logMealMode === 'ai' ? (
            <form onSubmit={handleLogMeal}>
              <label style={{ display: 'block', fontSize: '12px', color: '#00d9ff', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.5px' }}>
                Describe your meal
              </label>
              <textarea
                value={mealInput}
                onChange={(e) => setMealInput(e.target.value)}
                placeholder="e.g., 2 eggs, a bowl of brown rice, 150g grilled chicken, olive oil"
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  minHeight: '100px',
                  resize: 'vertical'
                }}
              />
              <p style={{ fontSize: '12px', color: '#666', margin: '8px 0 0' }}>
                Be specific about portions (e.g., "cup", "100g", "large", "2 slices")
              </p>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#00d9ff',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: '20px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#00b8d4'}
                onMouseLeave={(e) => e.target.style.background = '#00d9ff'}
              >
                Analyze & Log
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogManualMeal} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#00d9ff', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Meal name
                </label>
                <input
                  type="text"
                  value={manualMeal.name}
                  onChange={(e) => setManualMeal({ ...manualMeal, name: e.target.value })}
                  placeholder="e.g., Post-workout shake"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#ffa500', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Calories
                </label>
                <input
                  type="number"
                  value={manualMeal.calories}
                  onChange={(e) => setManualMeal({ ...manualMeal, calories: e.target.value })}
                  placeholder="e.g., 450"
                  required
                  min="0"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#00d9ff', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Protein (g)
                </label>
                <input
                  type="number"
                  value={manualMeal.protein}
                  onChange={(e) => setManualMeal({ ...manualMeal, protein: e.target.value })}
                  placeholder="e.g., 35"
                  required
                  min="0"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#00ff88', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Carbs (g)
                </label>
                <input
                  type="number"
                  value={manualMeal.carbs}
                  onChange={(e) => setManualMeal({ ...manualMeal, carbs: e.target.value })}
                  placeholder="e.g., 40"
                  required
                  min="0"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#ff6b6b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Fat (g)
                </label>
                <input
                  type="number"
                  value={manualMeal.fat}
                  onChange={(e) => setManualMeal({ ...manualMeal, fat: e.target.value })}
                  placeholder="e.g., 12"
                  required
                  min="0"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                Macros are added directly to today's progress — no AI needed.
              </p>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#00d9ff',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#00b8d4'}
                onMouseLeave={(e) => e.target.style.background = '#00d9ff'}
              >
                Log Meal
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Coach
  if (screen === 'coach') {
    return (
      <div style={{
        height: '100vh',
        background: '#0f0f0f',
        color: '#fff',
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '500px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          padding: `calc(env(safe-area-inset-top, 0px) + 16px) 20px 16px 20px`,
          borderBottom: '1px solid #222',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0
        }}>
          <button
            onClick={() => setScreen('dashboard')}
            style={{ ...backNavButtonStyle, marginBottom: 0, marginTop: 0, padding: '8px 4px 8px 0' }}
          >
            ← Back
          </button>
          <div>
            <h1 style={{ fontSize: '18px', margin: 0, fontWeight: 700 }}>AI Coach</h1>
            <p style={{ fontSize: '11px', color: '#666', margin: 0 }}>Ask me anything about your nutrition</p>
          </div>
          <button
            onClick={() => {
              setChatMessages([]);
              setCoachAdvice('');
              generateCoachAdvice();
            }}
            style={{
              marginLeft: 'auto',
              padding: '6px 12px',
              background: '#222',
              color: '#999',
              border: '1px solid #333',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Initial analysis message */}
          {coachLoading && chatMessages.length === 0 ? (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #00d9ff, #00ff88)',
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px'
              }}>💪</div>
              <div style={{
                background: '#1a1a1a', border: '1px solid #333',
                borderRadius: '12px 12px 12px 2px', padding: '12px 14px',
                maxWidth: '80%', fontSize: '14px', color: '#999'
              }}>
                Analyzing your nutrition...
              </div>
            </div>
          ) : coachAdvice && chatMessages.length === 0 ? (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #00d9ff, #00ff88)',
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px'
              }}>💪</div>
              <div style={{
                background: '#1a1a1a', border: '1px solid #333',
                borderRadius: '12px 12px 12px 2px', padding: '12px 14px',
                maxWidth: '85%', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap'
              }}>
                {coachAdvice}
              </div>
            </div>
          ) : !coachAdvice && chatMessages.length === 0 ? (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #00d9ff, #00ff88)',
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px'
              }}>💪</div>
              <div style={{
                background: '#1a1a1a', border: '1px solid #333',
                borderRadius: '12px 12px 12px 2px', padding: '12px 14px',
                maxWidth: '85%', fontSize: '14px', lineHeight: '1.6', color: '#999'
              }}>
                Hey {userData?.name}! Log some meals and I'll analyze your nutrition. You can also ask me anything about your diet right now!
              </div>
            </div>
          ) : null}

          {/* Chat messages */}
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
              }}
            >
              {msg.role === 'assistant' && (
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #00d9ff, #00ff88)',
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px'
                }}>💪</div>
              )}
              <div style={{
                background: msg.role === 'user' ? '#00d9ff' : '#1a1a1a',
                color: msg.role === 'user' ? '#000' : '#fff',
                border: msg.role === 'user' ? 'none' : '1px solid #333',
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                padding: '10px 14px',
                maxWidth: '80%',
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Loading bubble */}
          {chatLoading && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #00d9ff, #00ff88)',
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px'
              }}>💪</div>
              <div style={{
                background: '#1a1a1a', border: '1px solid #333',
                borderRadius: '12px 12px 12px 2px', padding: '12px 14px',
                fontSize: '14px', color: '#666'
              }}>
                Thinking...
              </div>
            </div>
          )}
        </div>

        {/* Suggested questions (show only when no chat yet) */}
        {chatMessages.length === 0 && !chatLoading && (
          <div style={{
            padding: '0 20px 12px',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            flexShrink: 0
          }}>
            {[
              'What should I eat post-workout?',
              'Am I eating enough protein?',
              'Best snack before bed?',
              'How to hit my carb goal?'
            ].map((q, i) => (
              <button
                key={i}
                onClick={() => sendChatMessage(q)}
                style={{
                  padding: '7px 12px',
                  background: '#1a1a1a',
                  color: '#00d9ff',
                  border: '1px solid #00d9ff33',
                  borderRadius: '20px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #222',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end',
          flexShrink: 0,
          background: '#0f0f0f'
        }}>
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!chatLoading && chatInput.trim()) sendChatMessage(chatInput);
              }
            }}
            placeholder="Ask your coach anything..."
            rows={1}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '20px',
              color: '#fff',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'none',
              outline: 'none',
              lineHeight: '1.4',
              maxHeight: '80px',
              overflowY: 'auto'
            }}
          />
          <button
            onClick={() => { if (!chatLoading && chatInput.trim()) sendChatMessage(chatInput); }}
            disabled={chatLoading || !chatInput.trim()}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: chatInput.trim() && !chatLoading ? '#00d9ff' : '#333',
              color: chatInput.trim() && !chatLoading ? '#000' : '#666',
              border: 'none',
              cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'default',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s'
            }}
          >
            ↑
          </button>
        </div>
      </div>
    );
  }

  // Progress
  if (screen === 'progress') {
    const progressData = progressPeriod === 'week'
      ? getWeeklyProgressData()
      : getMonthlyProgressData();

    return (
      <div style={subScreenWrapStyle}>
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <button
            onClick={() => setScreen('dashboard')}
            style={backNavButtonStyle}
          >
            ← Back
          </button>

          <h1 style={{ fontSize: '24px', margin: '0 0 16px', fontWeight: 700 }}>Progress</h1>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {[
              { id: 'week', label: 'Weekly' },
              { id: 'month', label: 'Monthly' }
            ].map(period => (
              <button
                key={period.id}
                type="button"
                onClick={() => setProgressPeriod(period.id)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: progressPeriod === period.id ? '#00d9ff' : '#1a1a1a',
                  color: progressPeriod === period.id ? '#000' : '#999',
                  border: `1px solid ${progressPeriod === period.id ? '#00d9ff' : '#333'}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {period.label}
              </button>
            ))}
          </div>

          <p style={{ fontSize: '12px', color: '#666', margin: '0 0 24px' }}>
            {progressPeriod === 'week'
              ? 'Sunday – Saturday (UTC+7)'
              : 'Last 30 days'}
          </p>

          <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ffa500' }}>
            Daily calories
          </h2>
          <div style={{ background: '#1a1a1a', padding: '16px', borderRadius: '6px', border: '1px solid #333', marginBottom: '32px', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#666' }} stroke="#333" />
                <YAxis domain={[0, 1500]} tick={{ fontSize: 11, fill: '#666' }} stroke="#333" />
                <Tooltip
                  contentStyle={{ background: '#222', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
                  formatter={(value) => Math.round(value)}
                />
                <Bar dataKey="calories" fill="#ffa500" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" fill="#333" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#00d9ff' }}>
            Daily protein
          </h2>
          <div style={{ background: '#1a1a1a', padding: '16px', borderRadius: '6px', border: '1px solid #333', height: '300px', marginBottom: '32px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#666' }} stroke="#333" />
                <YAxis tick={{ fontSize: 11, fill: '#666' }} stroke="#333" />
                <Tooltip
                  contentStyle={{ background: '#222', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
                  formatter={(value) => Math.round(value)}
                />
                <Line type="monotone" dataKey="protein" stroke="#00ff88" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="proteinTarget" stroke="#333" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#4fc3f7' }}>
            💧 Daily water intake
          </h2>
          <div style={{ background: '#1a1a1a', padding: '16px', borderRadius: '6px', border: '1px solid #333', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#666' }} stroke="#333" />
                <YAxis tick={{ fontSize: 11, fill: '#666' }} stroke="#333" />
                <Tooltip
                  contentStyle={{ background: '#222', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
                  formatter={(value, name) => [`${Math.round(value)}ml`, name === 'water' ? 'Intake' : 'Goal']}
                />
                <Bar dataKey="water" fill="#4fc3f7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="waterTarget" fill="#333" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  // Settings
  if (screen === 'settings') {
    return (
      <div style={subScreenWrapStyle}>
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <button
            onClick={() => setScreen('dashboard')}
            style={backNavButtonStyle}
          >
            ← Back
          </button>

          <h1 style={{ fontSize: '24px', margin: '0 0 32px', fontWeight: '700' }}>Settings</h1>

          {/* Account */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '12px', color: '#00d9ff', textTransform: 'uppercase', fontWeight: '600', marginBottom: '16px', letterSpacing: '0.5px' }}>
              Account
            </h2>
            <div style={{
              background: '#1a1a1a',
              padding: '16px',
              borderRadius: '6px',
              border: '1px solid #333',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <p style={{ fontSize: '14px', margin: 0, color: '#ccc' }}>@{getDisplayUsername(authUser)}</p>
              <button
                onClick={() => supabase.auth.signOut()}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#222',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Log Out
              </button>
            </div>
          </div>

          {/* Current Profile */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '12px', color: '#00d9ff', textTransform: 'uppercase', fontWeight: '600', marginBottom: '16px', letterSpacing: '0.5px' }}>
              Your Profile
            </h2>
            
            <div style={{
              background: '#1a1a1a',
              padding: '16px',
              borderRadius: '6px',
              border: '1px solid #333',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#999', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
                    Name
                  </p>
                  <p style={{ fontSize: '14px', margin: 0, fontWeight: '600' }}>{userData?.name}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#999', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
                    Age
                  </p>
                  <p style={{ fontSize: '14px', margin: 0, fontWeight: '600' }}>{userData?.age} years</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#999', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
                    Weight
                  </p>
                  <p style={{ fontSize: '14px', margin: 0, fontWeight: '600' }}>{userData?.weight} kg</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#999', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
                    Height
                  </p>
                  <p style={{ fontSize: '14px', margin: 0, fontWeight: '600' }}>{userData?.height} cm</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#999', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
                    Goal
                  </p>
                  <p style={{ fontSize: '14px', margin: 0, fontWeight: '600' }}>
                    {userData?.goal === 'build-muscle' ? 'Build Muscle' : userData?.goal === 'lose-fat' ? 'Lose Fat' : 'Maintain'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#999', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
                    Activity
                  </p>
                  <p style={{ fontSize: '14px', margin: 0, fontWeight: '600' }}>
                    {userData?.activityLevel === 'sedentary' ? 'Sedentary' : userData?.activityLevel === 'light' ? 'Light' : userData?.activityLevel === 'moderate' ? 'Moderate' : 'Intense'}
                  </p>
                </div>
              </div>

              {userData?.dietaryRestrictions && (
                <div>
                  <p style={{ fontSize: '12px', color: '#999', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
                    Restrictions
                  </p>
                  <p style={{ fontSize: '14px', margin: 0, fontWeight: '600' }}>{userData.dietaryRestrictions}</p>
                </div>
              )}
            </div>
          </div>

          {/* Macro Targets */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '12px', color: '#00d9ff', textTransform: 'uppercase', fontWeight: '600', marginBottom: '16px', letterSpacing: '0.5px' }}>
              Daily Targets
            </h2>
            
            <div style={{
              background: '#1a1a1a',
              padding: '16px',
              borderRadius: '6px',
              border: '1px solid #333',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px'
            }}>
              <div>
                <p style={{ fontSize: '12px', color: '#999', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
                  Calories
                </p>
                <p style={{ fontSize: '18px', margin: 0, fontWeight: '700', color: '#ffa500' }}>{userData?.macroTargets.calories}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: '#999', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
                  Protein
                </p>
                <p style={{ fontSize: '18px', margin: 0, fontWeight: '700', color: '#00d9ff' }}>{userData?.macroTargets.protein}g</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: '#999', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
                  Carbs
                </p>
                <p style={{ fontSize: '18px', margin: 0, fontWeight: '700', color: '#00ff88' }}>{userData?.macroTargets.carbs}g</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: '#999', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
                  Fat
                </p>
                <p style={{ fontSize: '18px', margin: 0, fontWeight: '700', color: '#ff6b6b' }}>{userData?.macroTargets.fat}g</p>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '12px', color: '#ff6b6b', textTransform: 'uppercase', fontWeight: '600', marginBottom: '16px', letterSpacing: '0.5px' }}>
              Danger Zone
            </h2>
            
            <button
              onClick={async () => {
                if (!authUser) return;
                try {
                  await deleteProfile(authUser.id);
                  setUserData(null);
                  setOnboardingStep(1);
                  setScreen('onboarding');
                } catch (error) {
                  console.error('Failed to reset profile:', error);
                  alert('Failed to reset profile. Please try again.');
                }
              }}
              style={{
                width: '100%',
                padding: '14px',
                background: '#ff6b6b',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => e.target.style.background = '#ff5252'}
              onMouseLeave={(e) => e.target.style.background = '#ff6b6b'}
            >
              Reset Profile Only
            </button>

            <p style={{ fontSize: '12px', color: '#999', margin: 0, marginBottom: '12px' }}>
              Change your height, weight, goals, or any profile info. Your meal history will be saved.
            </p>

            <button
              onClick={async () => {
                if (!authUser) return;
                if (window.confirm('Delete all data? This cannot be undone.')) {
                  try {
                    await Promise.all([
                      deleteAllMeals(authUser.id),
                      deleteAllWaterLogs(authUser.id),
                      deleteProfile(authUser.id)
                    ]);
                    setUserData(null);
                    setMeals([]);
                    setWaterTracker({});
                    setOnboardingStep(1);
                    setScreen('onboarding');
                  } catch (error) {
                    console.error('Failed to delete data:', error);
                    alert('Failed to delete data. Please try again.');
                  }
                }
              }}
              style={{
                width: '100%',
                padding: '14px',
                background: '#222',
                color: '#ff6b6b',
                border: '2px solid #ff6b6b',
                borderRadius: '6px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => { e.target.style.background = '#ff6b6b'; e.target.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.target.style.background = '#222'; e.target.style.color = '#ff6b6b'; }}
            >
              Delete Everything
            </button>

            <p style={{ fontSize: '12px', color: '#999', margin: '12px 0 0' }}>
              Delete all your profile data and meal history. Start fresh.
            </p>
          </div>
        </div>
      </div>
    );
  }
};

export default ForgeApp;