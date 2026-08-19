import { CAPTIONS } from '../ui.jsx';

export function StepPanel({
  done,
  stale,
  running,
  nextLabel,
  nextStep,
  lastError,
  styleValue,
  onStyleChange,
  onGenerate,
  onUnstick,
  onRetry,
}) {
  if (done) {
    return (
      <div className="step-panel">
        <div className="status-line" style={{ color: 'var(--grad-ink)' }}>
          <span className="gd-num-square done" style={{ width: 20, height: 20, fontSize: 11 }}>
            ✓
          </span>
          All 5 steps complete — nothing left to generate.
        </div>
        <p className="help">This project is done. Reopen it any time; nothing here regenerates automatically.</p>
      </div>
    );
  }

  if (stale) {
    return (
      <div className="step-panel">
        <div className="status-line" style={{ color: 'var(--grad-ink)' }}>
          This step was interrupted (probably a page refresh mid-request) and never finished.
        </div>
        <p className="help">Nothing before this step was affected — everything already generated is saved. Retrying is safe.</p>
        <button className="gd-btn gd-btn-secondary" style={{ marginTop: 14 }} onClick={onUnstick}>
          Retry {nextLabel}
        </button>
      </div>
    );
  }

  if (lastError && !running) {
    return (
      <div className="step-panel">
        <div className="status-line" style={{ color: 'var(--grad-ink)' }}>
          {nextLabel} failed: {lastError}
        </div>
        <p className="help">Completed steps are kept. Retry this step only — Gemini will not be called in a loop.</p>
        <button className="gd-btn gd-btn-secondary" style={{ marginTop: 14 }} onClick={onRetry}>
          Retry {nextLabel}
        </button>
      </div>
    );
  }

  const isStyleStep = nextStep === 'STYLE' && !running;

  return (
    <div className="step-panel">
      {running ? (
        <div className="status-line">
          <span className="spinner" /> {CAPTIONS[nextStep]} — real Gemini calls often take 10–30s or more…
        </div>
      ) : (
        <div className="status-line" style={{ color: 'var(--grad-ink)' }}>
          Ready for the next step: <b>{nextLabel}</b>.
        </div>
      )}
      {isStyleStep ? (
        <div className="gd-field" style={{ marginBottom: 14 }}>
          <label htmlFor="style-input">Art style (optional)</label>
          <input
            id="style-input"
            value={styleValue}
            onChange={(e) => onStyleChange(e.target.value)}
            placeholder="Leave blank to let Gemini choose a style based on your book"
          />
        </div>
      ) : null}
      <p className="help">Reopening this page mid-step won't fire a second request — it just shows the same in-flight state until it lands.</p>
      <button className="gd-btn gd-btn-primary" style={{ marginTop: 14 }} disabled={running} onClick={onGenerate}>
        {running ? 'Generating…' : `Generate ${nextLabel}`} {!running ? <span className="gd-arrow">→</span> : null}
      </button>
    </div>
  );
}
