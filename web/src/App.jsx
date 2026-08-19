import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { AuthPage } from './pages/AuthPage.jsx';
import { NewProjectPage } from './pages/NewProjectPage.jsx';
import { ProjectDetailPage } from './pages/ProjectDetailPage.jsx';
import { ProjectListPage } from './pages/ProjectListPage.jsx';
import { initials, Wordmark } from './ui.jsx';

export function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  async function signOut() {
    await api.signOut();
    setUser(null);
    navigate('/');
  }

  if (!ready) return null;

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? (
            <Navigate to="/projects" replace />
          ) : (
            <AuthPage onSignedIn={setUser} />
          )
        }
      />
      <Route
        path="/projects"
        element={
          user ? (
            <Shell user={user} onSignOut={signOut}>
              <ProjectListPage />
            </Shell>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/projects/new"
        element={
          user ? (
            <Shell user={user} onSignOut={signOut}>
              <NewProjectPage />
            </Shell>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/projects/:id"
        element={
          user ? (
            <Shell user={user} onSignOut={signOut}>
              <ProjectDetailPage user={user} />
            </Shell>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
    </Routes>
  );
}

function Shell({ user, onSignOut, children }) {
  const navigate = useNavigate();
  return (
    <>
      <div className="gd-nav">
        <div className="gd-nav-inner">
          <div className="gd-nav-logo" onClick={() => navigate('/projects')} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/projects')}>
            <Wordmark />
          </div>
          <div className="gd-nav-links">
            <a onClick={() => navigate('/projects')}>Projects</a>
          </div>
          <div className="gd-nav-user">
            <div className="gd-nav-avatar">{initials(user.name)}</div>
            {user.name}
            <a onClick={onSignOut}>Sign out</a>
          </div>
        </div>
      </div>
      {children}
      <footer className="app-footer">
        <span className="gd-signature">
          GRADION <b>|</b> Scaling Business
        </span>
      </footer>
    </>
  );
}
