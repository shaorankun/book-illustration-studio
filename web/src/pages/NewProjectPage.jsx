import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export function NewProjectPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [bookText, setBookText] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBookText(String(reader.result || ''));
      setFileName(file.name);
    };
    reader.readAsText(file);
  }

  async function create() {
    setBusy(true);
    setError('');
    try {
      const project = await api.createProject({ title, bookText });
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-body narrow">
      <a className="back-link" onClick={() => navigate('/projects')}>
        ← Back to projects
      </a>
      <h3 style={{ fontSize: 20 }}>Start a new illustration project</h3>
      <p className="meta" style={{ marginBottom: 20 }}>
        Give it a title, then paste the book's text or upload a .txt file.
      </p>
      <div className="gd-field">
        <label htmlFor="f-title">
          Project title <span className="req">*</span>
        </label>
        <input
          id="f-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. The Wind in the Willows — cottage-core"
        />
      </div>
      <div className="gd-field" style={{ marginTop: 16 }}>
        <label htmlFor="book-textarea">
          Book text <span className="req">*</span>
        </label>
        <div
          className={`dropzone ${fileName ? 'has-file' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => document.getElementById('file-input').click()}
        >
          <div id="dropzone-label" style={{ fontSize: 13, fontWeight: 600, color: 'var(--grad-ink)' }}>
            {fileName ? `✓ ${fileName} loaded` : 'Click to choose a .txt file'}
          </div>
          <div className="hint">Plain text only · used once as context for every step below</div>
        </div>
        <input
          type="file"
          id="file-input"
          accept=".txt"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
        <div className="divider-or">or paste text</div>
        <textarea
          id="book-textarea"
          rows={5}
          value={bookText}
          onChange={(e) => setBookText(e.target.value)}
          placeholder="Once upon a time, in a small burrow by the river..."
        />
      </div>
      {error ? <div className="gd-field err">{error}</div> : null}
      <button className="gd-btn gd-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 20 }} onClick={create} disabled={busy}>
        Create project <span className="gd-arrow">→</span>
      </button>
    </div>
  );
}
