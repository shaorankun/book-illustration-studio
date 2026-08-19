import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState.jsx';

describe('EmptyState', () => {
  it('shows the empty copy and a create action', () => {
    const onCreate = vi.fn();
    render(<EmptyState onCreate={onCreate} />);
    expect(screen.getByText('No projects yet.')).toBeInTheDocument();
    screen.getByRole('button', { name: '+ New project' }).click();
    expect(onCreate).toHaveBeenCalled();
  });
});
