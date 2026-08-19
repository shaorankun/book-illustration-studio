export function EmptyState({ onCreate }) {
  return (
    <div className="empty-state">
      <p style={{ margin: 0 }}>No projects yet.</p>
      <button className="gd-btn gd-btn-primary" onClick={onCreate}>
        + New project
      </button>
    </div>
  );
}
