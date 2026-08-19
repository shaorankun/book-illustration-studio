import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { StepPanel } from '../components/StepPanel.jsx';
import { STEP_LABELS, snippet } from '../ui.jsx';

export function ProjectDetailPage({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [styleValue, setStyleValue] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  async function refresh() {
    const data = await api.project(id);
    setProject(data);
    return data;
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!project || project.stepState !== 'RUNNING' || project.stale) return undefined;
    const t = setInterval(() => {
      refresh().catch(() => {});
    }, 1500);
    return () => clearInterval(t);
  }, [project?.id, project?.stepState, project?.stale]);

  async function generate() {
    setError('');
    try {
      const updated = await api.runStep(id, project.nextStep, { style: styleValue });
      setProject(updated);
    } catch (err) {
      if (err.status === 409) {
        refresh().catch(() => {});
        return;
      }
      setError(err.message);
    }
  }

  async function unstick() {
    const updated = await api.unstick(id);
    setProject(updated);
  }

  if (error && !project) {
    return (
      <div className="app-body">
        <p className="gd-field err">{error}</p>
      </div>
    );
  }
  if (!project) return <div className="app-body">Loading…</div>;

  const running = project.stepState === 'RUNNING' && !project.stale;
  const done = project.status === 'DONE';
  const idx = project.progress;
  const portraitsRunning = running && project.nextStep === 'PORTRAITS';
  const illustrationsRunning = running && project.nextStep === 'ILLUSTRATIONS';
  const truncated = (project.bookText || '').replace(/\s+/g, ' ').trim().length > 220;

  return (
    <div className="app-body">
      <a className="back-link" onClick={() => navigate('/projects')}>
        ← Back to projects
      </a>
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>{project.title}</h2>
      <p className="meta" style={{ marginBottom: 24 }}>
        Created {new Date(project.createdAt).toLocaleDateString()} by {user.name}
      </p>
      <Stepper statusIndex={idx} />
      <div className="detail-grid">
        <div>
          <StepPanel
            done={done}
            stale={project.stale}
            running={running}
            nextLabel={project.nextLabel}
            nextStep={project.nextStep}
            lastError={project.lastError}
            styleValue={styleValue}
            onStyleChange={setStyleValue}
            onGenerate={generate}
            onUnstick={unstick}
            onRetry={generate}
          />
          {error ? <p className="gd-field err" style={{ marginTop: 12 }}>{error}</p> : null}
          {project.chapters.length ? (
            <div style={{ marginTop: 28 }}>
              <div className="panel-title">
                <h3>Chapters ({project.chapters.length})</h3>
              </div>
              <div className="entity-grid" style={{ gridTemplateColumns: '1fr', marginBottom: 28 }}>
                {project.chapters.map((c, i) => (
                  <EntityCard key={c.name} item={c} kind="chapter" generating={illustrationsRunning && !c.illustrationUrl} index={i} />
                ))}
              </div>
            </div>
          ) : null}
          {project.characters.length ? (
            <div style={{ marginTop: 28 }}>
              <div className="panel-title">
                <h3>Characters ({project.characters.length})</h3>
              </div>
              <div className="entity-grid">
                {project.characters.map((c, i) => {
                  const generating =
                    portraitsRunning &&
                    !c.portraitUrl &&
                    project.characters.slice(0, i).every((prev) => prev.portraitUrl);
                  return <EntityCard key={c.name} item={c} kind="character" generating={generating} index={i} />;
                })}
              </div>
            </div>
          ) : null}
        </div>
        <div>
          {project.style ? (
            <div className="side-note">
              <h5>Style</h5>
              <p>{project.style}</p>
            </div>
          ) : (
            <div className="side-note">
              <h5>Book text</h5>
              <p style={{ fontStyle: 'italic' }}>{snippet(project.bookText, 220)}</p>
              {truncated ? (
                <button type="button" className="gd-btn gd-btn-ghost gd-btn-sm" style={{ paddingLeft: 0, marginTop: 8 }} onClick={() => setModalOpen(true)}>
                  Read full text →
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
      {modalOpen ? (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-box" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h4 style={{ margin: 0 }}>Full book text</h4>
              <button type="button" className="modal-close" onClick={() => setModalOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="modal-body">{project.bookText}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stepper({ statusIndex }) {
  return (
    <div className="stepper">
      {STEP_LABELS.map((label, i) => {
        const done = i < statusIndex;
        const isCurrent = i === statusIndex;
        const cls = done ? 'done' : isCurrent ? 'current' : 'pending';
        return (
          <span key={label} style={{ display: 'contents' }}>
            <div className={`step ${cls}`}>
              {done ? (
                <span className="gd-num-square done">✓</span>
              ) : (
                <span className={`gd-num-square ${isCurrent ? '' : 'gray'}`}>{i + 1}</span>
              )}
              <span className="lbl">{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 ? <div className={`connector ${i < statusIndex ? 'done' : ''}`} /> : null}
          </span>
        );
      })}
    </div>
  );
}

function EntityCard({ item, kind, generating, index }) {
  const ready = kind === 'character' ? item.portraitUrl : item.illustrationUrl;
  const artClass = kind === 'character' ? 'art' : 'art chapter';
  let art;
  if (ready) {
    art = (
      <div className={artClass}>
        <img src={ready} alt={item.name} />
      </div>
    );
  } else if (generating) {
    art = (
      <div className={`${artClass} pending`}>
        <div style={{ textAlign: 'center' }}>
          <span className="spinner" />
          <div className="gen-caption">
            Generating{kind === 'character' ? ` portrait for ${item.name}` : ' illustration'}…
          </div>
        </div>
      </div>
    );
  } else {
    art = (
      <div className={`${artClass} pending`}>
        <span className="placeholder-label muted">Not generated yet</span>
      </div>
    );
  }
  return (
    <div className="entity-card" style={{ '--stagger': `${index * 60}ms` }}>
      {art}
      <div className="body">
        <h5>{item.name}</h5>
        <p>{item.prompt}</p>
      </div>
    </div>
  );
}

