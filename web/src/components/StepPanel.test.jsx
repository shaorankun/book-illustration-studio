import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StepPanel } from './StepPanel.jsx';

describe('StepPanel', () => {
  it('names the running step instead of a bare spinner', () => {
    render(
      <StepPanel
        running
        nextStep="PORTRAITS"
        nextLabel="Portraits"
        onGenerate={vi.fn()}
      />,
    );
    expect(screen.getByText(/Generating character portraits/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled();
  });

  it('shows an error with a retry button for that step', () => {
    const onRetry = vi.fn();
    render(
      <StepPanel
        nextStep="STYLE"
        nextLabel="Style"
        lastError="quota exceeded"
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText(/Style failed: quota exceeded/)).toBeInTheDocument();
    screen.getByRole('button', { name: 'Retry Style' }).click();
    expect(onRetry).toHaveBeenCalled();
  });
});
