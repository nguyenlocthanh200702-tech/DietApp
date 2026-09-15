import React from 'react';
import { TIMEZONE_PROFILES } from '../lib/timezoneProfiles';

const ProfilePickerScreen = ({ summaries, onSelect }) => {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
      color: '#fff',
      padding: '20px',
      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 28px)',
      fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ maxWidth: '420px', width: '100%' }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 700, marginBottom: '8px' }}>Choose profile</h1>
          <p style={{ fontSize: '14px', color: '#999', margin: 0, lineHeight: 1.5 }}>
            Each profile uses its own timezone for daily totals and progress.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {TIMEZONE_PROFILES.map(profile => {
            const summary = summaries.find(s => s.timezoneKey === profile.key);
            const tzLabel = profile.subtitle;

            return (
              <button
                key={profile.key}
                type="button"
                onClick={() => onSelect(profile.key)}
                style={{
                  textAlign: 'left',
                  padding: '20px',
                  background: '#1a1a1a',
                  border: '2px solid #333',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#fff',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#00d9ff';
                  e.currentTarget.style.background = '#222';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#333';
                  e.currentTarget.style.background = '#1a1a1a';
                }}
              >
                <h2 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700, color: '#00d9ff' }}>
                  {profile.title}
                </h2>
                <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#888' }}>{tzLabel}</p>
                {summary?.name ? (
                  <p style={{ margin: 0, fontSize: '14px', color: '#ccc' }}>
                    Signed in as <strong style={{ color: '#fff' }}>{summary.name}</strong>
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>No setup yet — tap to create</p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProfilePickerScreen;
