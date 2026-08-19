import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { EmptyState } from '../components/EmptyState.jsx';
import { STEP_LABELS } from '../ui.jsx';

export function ProjectListPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .projects()
      .then((data) => setProjects(data.projects))
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="app-body">
        <p className="gd-field err">{error}</p>
      </div>
    );
  }
  if (!projects) return <div className="app-body">Loading…</div>;
  if (!projects.length) {
    return (
      <div className="app-body">
        <div className="list-head">
          <h2>Your projects</h2>
        </div>
        <EmptyState onCreate={() => navigate('/projects/new')} />
      </div>
    );
  }

  return (
    <div className="app-body">
      <div className="list-head">
        <h2>Your projects</h2>
        <button className="gd-btn gd-btn-primary" onClick={() => navigate('/projects/new')}>
          + New project
        </button>
      </div>
      <div className="project-list">
        {projects.map((p, i) => (
          <div
            key={p.id}
            className="project-row"
            style={{ '--stagger': `${i * 45}ms` }}
            tabIndex={0}
            onClick={() => navigate(`/projects/${p.id}`)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/projects/${p.id}`)}
          >
            <div className="title">
              <h4>{p.title}</h4>
              <span className="meta">
                Created {new Date(p.createdAt).toLocaleDateString()} · {p.subtitle}
              </span>
            </div>
            <div className="progress-mini">
              {STEP_LABELS.map((_, idx) => (
                <span key={idx} className={`seg ${idx < p.progress ? 'on' : ''}`} />
              ))}
            </div>
            {p.pill === 'Done' ? (
              <span className="gd-pill ink">Done</span>
            ) : p.pill === 'Draft' ? (
              <span className="gd-pill gray">Draft</span>
            ) : (
              <span className="gd-pill">
                <span className="dot" />
                In progress
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
