async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  me: () => request('/api/me'),
  signIn: (body) => request('/api/session', { method: 'POST', body: JSON.stringify(body) }),
  signOut: () => request('/api/session/logout', { method: 'POST' }),
  projects: () => request('/api/projects'),
  createProject: (body) => request('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  project: (id) => request(`/api/projects/${id}`),
  runStep: (id, step, body = {}) =>
    request(`/api/projects/${id}/steps/${step}`, { method: 'POST', body: JSON.stringify(body) }),
  unstick: (id) => request(`/api/projects/${id}/unstick`, { method: 'POST' }),
};
