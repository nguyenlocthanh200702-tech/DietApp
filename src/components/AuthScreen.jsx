import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  normalizeUsername,
  validateUsername,
  usernameToAuthEmail
} from '../lib/authHelpers';

const inputStyle = {
  width: '100%',
  padding: '12px',
  background: '#222',
  border: '1px solid #333',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '14px',
  boxSizing: 'border-box'
};

const AuthScreen = () => {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    const normalized = normalizeUsername(username);
    const authEmail = usernameToAuthEmail(normalized);

    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password
        });
        if (authError) throw authError;
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email: authEmail,
          password,
          options: {
            data: { username: normalized }
          }
        });
        if (authError) throw authError;
        setMessage('Account created! You can log in now.');
        setMode('login');
      }
    } catch (err) {
      const msg = err.message || 'Authentication failed';
      if (msg.toLowerCase().includes('invalid login credentials')) {
        setError('Invalid username or password');
      } else if (msg.toLowerCase().includes('already registered')) {
        setError('That username is already taken');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

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
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '36px', margin: 0, fontWeight: 700, color: '#00d9ff', marginBottom: '8px' }}>FORGE</h1>
          <p style={{ fontSize: '14px', color: '#999', margin: 0 }}>
            {mode === 'login' ? 'Log in to sync your data across devices' : 'Create an account to save your progress'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {['login', 'signup'].map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); setMessage(''); }}
              style={{
                flex: 1,
                padding: '10px',
                background: mode === m ? '#00d9ff' : '#1a1a1a',
                color: mode === m ? '#000' : '#999',
                border: `1px solid ${mode === m ? '#00d9ff' : '#333'}`,
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {m === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#00d9ff', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              autoComplete="username"
              placeholder="e.g., jerry_nguyen"
              style={inputStyle}
            />
            {mode === 'signup' && (
              <p style={{ fontSize: '11px', color: '#666', margin: '6px 0 0' }}>
                Letters, numbers, and underscores only
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#00d9ff', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              style={inputStyle}
            />
          </div>

          {error && (
            <p style={{ color: '#ff6b6b', fontSize: '13px', margin: 0 }}>{error}</p>
          )}
          {message && (
            <p style={{ color: '#00ff88', fontSize: '13px', margin: 0 }}>{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#333' : '#00d9ff',
              color: loading ? '#666' : '#000',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthScreen;
