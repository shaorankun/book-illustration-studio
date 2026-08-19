import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Wordmark } from '../ui.jsx';

export function AuthPage({ onSignedIn }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const user = await api.signIn({ name, email });
      onSignedIn(user);
      navigate('/projects');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <div className="auth-card">
        <div className="logo-row">
          <Wordmark />
        </div>
        <h3 style={{ textAlign: 'center', fontSize: 20 }}>Book Illustration Studio</h3>
        <p className="lede">Enter your details to start or resume an illustration project.</p>
        <div className="gd-field">
          <label htmlFor="f-name">
            Full name <span className="req">*</span>
          </label>
          <input id="f-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mira Hassan" />
        </div>
        <div className="gd-field">
          <label htmlFor="f-email">
            Email <span className="req">*</span>
          </label>
          <input
            id="f-email"
            type="email"
            value={email}
            placeholder="mira@example.com"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        {error ? <div className="gd-field err">{error}</div> : null}
        <button className="gd-btn gd-btn-primary" onClick={submit} disabled={busy}>
          Continue <span className="gd-arrow">→</span>
        </button>
        <p className="meta" style={{ textAlign: 'center', marginTop: 14 }}>
          No password — this is a lightweight identity check. Using an email that already has projects resumes them exactly where you left off.
        </p>
      </div>
    </div>
  );
}
