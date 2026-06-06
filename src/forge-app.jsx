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
  const [editingMealId, setEditingMealId] = useState(null);
  const [editingMealInput, setEditingMealInput] = useState('');
  const [waterTracker, setWaterTracker] = useState({});

  // Load data from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('forgeUserData');
    const savedMeals = localStorage.getItem('forgeMeals');
    const savedWater = localStorage.getItem('forgeWaterTracker');
    if (saved) {
      setUserData(JSON.parse(saved));
      setScreen('dashboard');
    }
    if (savedMeals) {
      setMeals(JSON.parse(savedMeals));
    }
    if (savedWater) {
      setWaterTracker(JSON.parse(savedWater));
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

  // Update water intake
  const updateWaterIntake = (amount) => {
    const today = new Date().toISOString().split('T')[0];
    const currentIntake = waterTracker[today] || 0;
    const newIntake = Math.max(0, Math.min(currentIntake + amount, userData?.waterGoal || 2000));
    
    setWaterTracker({
      ...waterTracker,
      [today]: newIntake
    });
    
    // Save to localStorage
    localStorage.setItem('forgeWaterTracker', JSON.stringify({
      ...waterTracker,
      [today]: newIntake
    }));
  };

  // Get today's water intake
  const getTodayWaterIntake = () => {
    const today = new Date().toISOString().split('T')[0];
    return waterTracker[today] || 0;
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

  // Delete a meal
  const deleteMeal = (mealId) => {
    setMeals(meals.filter(m => m.id !== mealId));
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
    
    if (macros) {
      setMeals(meals.map(m => 
        m.id === mealId 
          ? {
              ...m,
              description: editingMealInput,
              mealName: macros.mealName || 'Meal',
              calories: macros.calories,
              protein: macros.protein,
              carbs: macros.carbs,
              fat: macros.fat
            }
          : m
      ));
      
      setEditingMealId(null);
      setEditingMealInput('');
    }
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
      data[dateStr] = {
        date: dateStr,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        target: userData?.macroTargets.calories || 0,
        proteinTarget: userData?.macroTargets.protein || 0,
        water: waterTracker[dateStr] || 0,
        waterTarget: userData?.waterGoal || 2000
      };
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
              localStorage.setItem('forgeProfileData', JSON.stringify({
                name: formData.get('name'),
                weight: parseFloat(formData.get('weight')),
                height: parseFloat(formData.get('height')),
                age: parseInt(formData.get('age')),
                goal: formData.get('goal'),
                activityLevel: formData.get('activity'),
                dietaryRestrictions: formData.get('restrictions'),
              }));
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
                  const profileData = JSON.parse(localStorage.getItem('forgeProfileData'));
                  const macroTargets = calculateMacroTargets(
                    profileData.weight,
                    profileData.height,
                    profileData.age,
                    profileData.goal,
                    profileData.activityLevel
                  );
                  
                  const newUserData = {
                    ...profileData,
                    macroTargets,
                    createdAt: new Date().toISOString()
                  };
                  
                  localStorage.setItem('forgeUserData', JSON.stringify(newUserData));
                  localStorage.removeItem('forgeProfileData');
                  setUserData(newUserData);
                  setOnboardingStep(4); // Go to water setup
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
              const profileData = JSON.parse(localStorage.getItem('forgeProfileData'));
              
              const newUserData = {
                ...profileData,
                macroTargets: {
                  calories: parseInt(formData.get('calories')),
                  protein: parseInt(formData.get('protein')),
                  carbs: parseInt(formData.get('carbs')),
                  fat: parseInt(formData.get('fat'))
                },
                createdAt: new Date().toISOString()
              };

              localStorage.setItem('forgeUserData', JSON.stringify(newUserData));
              localStorage.removeItem('forgeProfileData');
              setUserData(newUserData);
              setOnboardingStep(4); // Go to water setup
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
                  const savedUser = JSON.parse(localStorage.getItem('forgeUserData'));
                  // Auto water goal: standard 2000ml recommendation
                  const waterGoal = Math.round((savedUser.weight || 70) * 35 / 100) * 100;
                  savedUser.waterGoal = Math.max(waterGoal, 2000);
                  savedUser.bottleSize = 2000;
                  localStorage.setItem('forgeUserData', JSON.stringify(savedUser));
                  setUserData(savedUser);
                  setOnboardingStep(1);
                  setScreen('dashboard');
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
              const savedUser = JSON.parse(localStorage.getItem('forgeUserData'));
              
              savedUser.waterGoal = parseInt(formData.get('waterGoal'));
              savedUser.bottleSize = parseInt(formData.get('bottleSize'));
              
              localStorage.setItem('forgeUserData', JSON.stringify(savedUser));
              setUserData(savedUser);
              setOnboardingStep(1);
              setScreen('dashboard');
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
                    onChange={(e) => {
                      const newVal = parseInt(e.target.value);
                      const today = new Date().toISOString().split('T')[0];
                      const updated = { ...waterTracker, [today]: newVal };
                      setWaterTracker(updated);
                      localStorage.setItem('forgeWaterTracker', JSON.stringify(updated));
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
            
            {meals.filter(m => m.timestamp.split('T')[0] === new Date().toISOString().split('T')[0]).length === 0 ? (
              <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No meals logged yet today</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {meals.filter(m => m.timestamp.split('T')[0] === new Date().toISOString().split('T')[0]).map(meal => (
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