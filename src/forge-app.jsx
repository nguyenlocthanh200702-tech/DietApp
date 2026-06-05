import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const ForgeApp = () => {
  const [screen, setScreen] = useState('onboarding'); // onboarding, onboarding-macros, dashboard, log-meal, coach, progress, settings
  const [onboardingStep, setOnboardingStep] = useState(1); // 1: profile, 2: macro choice, 3: manual macros
  const [userData, setUserData] = useState(null);
  const [meals, setMeals] = useState([]);
  const [mealInput, setMealInput] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachAdvice, setCoachAdvice] = useState('');

  // Load data from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('forgeUserData');
    const savedMeals = localStorage.getItem('forgeMeals');
    if (saved) {
      setUserData(JSON.parse(saved));
      setScreen('dashboard');
    }
    if (savedMeals) {
      setMeals(JSON.parse(savedMeals));
    }
  }, []);

  // Save meals to localStorage whenever they change
  useEffect(() => {
    if (meals.length > 0) {
      localStorage.setItem('forgeMeals', JSON.stringify(meals));
    }
  }, [meals]);

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

  // Store temporary onboarding data
  const [tempOnboardingData, setTempOnboardingData] = useState(null);

  // Handle onboarding step 1 (profile data)
  const handleOnboardingStep1 = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      weight: parseFloat(formData.get('weight')),
      height: parseFloat(formData.get('height')),
      age: parseInt(formData.get('age')),
      gender: formData.get('gender'),
      dietaryRestrictions: formData.get('restrictions'),
      createdAt: new Date().toISOString()
    };
    
    setTempOnboardingData(data);
    setOnboardingStep(2); // Move to macro choice step
  };

  // Handle macro choice (auto vs manual)
  const handleMacroChoice = (choice) => {
    if (choice === 'auto') {
      // Auto-calculate based on goal and activity
      const formData = new FormData(document.querySelector('form'));
      const goal = formData.get('goal');
      const activityLevel = formData.get('activity');
      
      const data = {
        ...tempOnboardingData,
        goal,
        activityLevel
      };
      
      data.macroTargets = calculateMacroTargets(data.weight, data.height, data.age, data.goal, data.activityLevel);
      
      localStorage.setItem('forgeUserData', JSON.stringify(data));
      setUserData(data);
      setScreen('dashboard');
    } else {
      // Manual macro input
      setOnboardingStep(3);
    }
  };

  // Handle manual macro input
  const handleManualMacros = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      ...tempOnboardingData,
      goal: 'custom',
      activityLevel: 'custom',
      macroTargets: {
        calories: parseInt(formData.get('calories')),
        protein: parseInt(formData.get('protein')),
        carbs: parseInt(formData.get('carbs')),
        fat: parseInt(formData.get('fat'))
      }
    };
    
    localStorage.setItem('forgeUserData', JSON.stringify(data));
    setUserData(data);
    setScreen('dashboard');
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

  // Handle meal logging
  const handleLogMeal = async (e) => {
    e.preventDefault();
    if (!mealInput.trim()) return;

    const macros = await estimateMealMacros(mealInput);
    
    if (macros) {
      const newMeal = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        description: mealInput,
        mealName: macros.mealName || 'Meal',
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat
      };
      
      setMeals([...meals, newMeal]);
      setMealInput('');
    }
  };

  // Get today's totals
  const getTodayTotals = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayMeals = meals.filter(m => m.timestamp.split('T')[0] === today);
    
    return {
      calories: todayMeals.reduce((sum, m) => sum + m.calories, 0),
      protein: todayMeals.reduce((sum, m) => sum + m.protein, 0),
      carbs: todayMeals.reduce((sum, m) => sum + m.carbs, 0),
      fat: todayMeals.reduce((sum, m) => sum + m.fat, 0)
    };
  };

  // Call backend for coaching advice
  const generateCoachAdvice = async () => {
    setCoachLoading(true);
    
    const last7Days = meals.filter(m => {
      const mealDate = new Date(m.timestamp);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return mealDate >= sevenDaysAgo;
    });

    const dailyData = {};
    last7Days.forEach(meal => {
      const date = meal.timestamp.split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      }
      dailyData[date].calories += meal.calories;
      dailyData[date].protein += meal.protein;
      dailyData[date].carbs += meal.carbs;
      dailyData[date].fat += meal.fat;
    });

    const summary = Object.entries(dailyData).map(([date, macros]) => 
      `${date}: ${macros.calories}cal, ${macros.protein}g protein, ${macros.carbs}g carbs, ${macros.fat}g fat`
    ).join('\n');

    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://your-vercel-function.vercel.app';
      
      const response = await fetch(`${backendUrl}/api/get-coaching`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mealSummary: summary,
          goal: userData.goal,
          macroTargets: userData.macroTargets
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setCoachAdvice(data.advice);
    } catch (error) {
      console.error('Error getting coach advice:', error);
      setCoachAdvice('Unable to get advice right now. Keep logging your meals!');
    }
    
    setCoachLoading(false);
  };

  // Get progress chart data (last 30 days)
  const getProgressData = () => {
    const data = {};
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      data[dateStr] = { date: dateStr, calories: 0, protein: 0, carbs: 0, fat: 0, target: userData?.macroTargets.calories || 0, proteinTarget: userData?.macroTargets.protein || 0 };
    }
    
    meals.forEach(meal => {
      const dateStr = meal.timestamp.split('T')[0];
      if (data[dateStr]) {
        data[dateStr].calories += meal.calories;
        data[dateStr].protein += meal.protein;
        data[dateStr].carbs += meal.carbs;
        data[dateStr].fat += meal.fat;
      }
    });
    
    return Object.values(data);
  };

  const todayTotals = getTodayTotals();

  // Macro ring component
  const MacroRing = ({ label, current, target, color }) => {
    const percentage = Math.min((current / target) * 100, 100);
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r="45" fill="none" stroke="#333" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
            {label}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginTop: '4px' }}>
            {Math.round(current)} / {target}
          </div>
        </div>
      </div>
    );
  };

  // Screens
  if (screen === 'onboarding') {
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

          <form onSubmit={handleOnboardingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
              Start Training
            </button>
          </form>
        </div>
      </div>
    );
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '40px' }}>
            <MacroRing label="Protein" current={todayTotals.protein} target={userData?.macroTargets.protein || 150} color="#00d9ff" />
            <MacroRing label="Carbs" current={todayTotals.carbs} target={userData?.macroTargets.carbs || 250} color="#00ff88" />
            <MacroRing label="Fat" current={todayTotals.fat} target={userData?.macroTargets.fat || 80} color="#ff6b6b" />
            <MacroRing label="Calories" current={todayTotals.calories} target={userData?.macroTargets.calories || 2500} color="#ffa500" />
          </div>

          {/* Today's Meals */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#00d9ff' }}>
              Today's meals
            </h2>
            
            {meals.filter(m => m.timestamp.split('T')[0] === new Date().toISOString().split('T')[0]).length === 0 ? (
              <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No meals logged yet today</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {meals.filter(m => m.timestamp.split('T')[0] === new Date().toISOString().split('T')[0]).map(meal => (
                  <div
                    key={meal.id}
                    style={{
                      background: '#1a1a1a',
                      padding: '12px',
                      borderRadius: '6px',
                      border: '1px solid #333',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>{meal.mealName}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#999' }}>
                        {meal.calories} cal • P: {meal.protein}g • C: {meal.carbs}g • F: {meal.fat}g
                      </p>
                    </div>
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
              onClick={() => { generateCoachAdvice(); setScreen('coach'); }}
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
      <div style={{
        minHeight: '100vh',
        background: '#0f0f0f',
        color: '#fff',
        padding: '20px',
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
        paddingBottom: '100px'
      }}>
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <button
            onClick={() => setScreen('dashboard')}
            style={{
              background: 'none',
              border: 'none',
              color: '#00d9ff',
              cursor: 'pointer',
              fontSize: '14px',
              marginBottom: '24px',
              fontWeight: 600
            }}
          >
            ← Back
          </button>

          <h1 style={{ fontSize: '24px', margin: '0 0 24px', fontWeight: 700 }}>Log a meal</h1>

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
        </div>
      </div>
    );
  }

  // Coach
  if (screen === 'coach') {
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
          <button
            onClick={() => setScreen('dashboard')}
            style={{
              background: 'none',
              border: 'none',
              color: '#00d9ff',
              cursor: 'pointer',
              fontSize: '14px',
              marginBottom: '24px',
              fontWeight: 600
            }}
          >
            ← Back
          </button>

          <h1 style={{ fontSize: '24px', margin: '0 0 24px', fontWeight: 700 }}>Your AI Coach</h1>

          {coachLoading ? (
            <div style={{
              background: '#1a1a1a',
              padding: '24px',
              borderRadius: '6px',
              border: '1px solid #333',
              textAlign: 'center',
              color: '#999'
            }}>
              <p style={{ margin: 0 }}>Analyzing your nutrition data...</p>
            </div>
          ) : coachAdvice ? (
            <div style={{
              background: '#1a1a1a',
              padding: '20px',
              borderRadius: '6px',
              border: '1px solid #333',
              lineHeight: '1.6',
              fontSize: '14px',
              whiteSpace: 'pre-wrap'
            }}>
              {coachAdvice}
            </div>
          ) : (
            <p style={{ color: '#666', fontSize: '14px' }}>Log some meals first, then ask for personalized advice!</p>
          )}

          {coachAdvice && (
            <button
              onClick={() => { generateCoachAdvice(); }}
              style={{
                width: '100%',
                padding: '12px',
                background: '#333',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '12px',
                marginTop: '16px'
              }}
            >
              Get Fresh Advice
            </button>
          )}
        </div>
      </div>
    );
  }

  // Progress
  if (screen === 'progress') {
    const progressData = getProgressData();
    
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
          <button
            onClick={() => setScreen('dashboard')}
            style={{
              background: 'none',
              border: 'none',
              color: '#00d9ff',
              cursor: 'pointer',
              fontSize: '14px',
              marginBottom: '24px',
              fontWeight: 600
            }}
          >
            ← Back
          </button>

          <h1 style={{ fontSize: '24px', margin: '0 0 24px', fontWeight: 700 }}>30-Day Progress</h1>

          <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#00d9ff' }}>
            Daily calories
          </h2>
          <div style={{ background: '#1a1a1a', padding: '16px', borderRadius: '6px', border: '1px solid #333', marginBottom: '32px', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#666' }} stroke="#333" />
                <YAxis tick={{ fontSize: 11, fill: '#666' }} stroke="#333" />
                <Tooltip
                  contentStyle={{ background: '#222', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
                  formatter={(value) => Math.round(value)}
                />
                <Bar dataKey="calories" fill="#00d9ff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" fill="#333" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#00d9ff' }}>
            Daily protein
          </h2>
          <div style={{ background: '#1a1a1a', padding: '16px', borderRadius: '6px', border: '1px solid #333', height: '300px' }}>
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
        </div>
      </div>
    );
  }

  // Settings
  if (screen === 'settings') {
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
          <button
            onClick={() => setScreen('dashboard')}
            style={{
              background: 'none',
              border: 'none',
              color: '#00d9ff',
              cursor: 'pointer',
              fontSize: '14px',
              marginBottom: '24px',
              fontWeight: '600'
            }}
          >
            ← Back
          </button>

          <h1 style={{ fontSize: '24px', margin: '0 0 32px', fontWeight: '700' }}>Settings</h1>

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
              onClick={() => {
                localStorage.removeItem('forgeUserData');
                setUserData(null);
                setScreen('onboarding');
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
              onClick={() => {
                if (window.confirm('Delete all data? This cannot be undone.')) {
                  localStorage.removeItem('forgeUserData');
                  localStorage.removeItem('forgeMeals');
                  setUserData(null);
                  setMeals([]);
                  setScreen('onboarding');
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