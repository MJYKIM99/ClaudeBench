import { describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '../../test/utils';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    render(
      <Dialog open={false} onClose={() => {}}>
        Content
      </Dialog>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders content when open', () => {
    render(
      <Dialog open={true} onClose={() => {}}>
        Dialog Content
      </Dialog>
    );
    expect(screen.getByText('Dialog Content')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(
      <Dialog open={true} onClose={() => {}} title="Test Title">
        Content
      </Dialog>
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <Dialog open={true} onClose={onClose} title="Test">
        Content
      </Dialog>
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay clicked', () => {
    const onClose = vi.fn();
    render(
      <Dialog open={true} onClose={onClose}>
        Content
      </Dialog>
    );
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders footer when provided', () => {
    render(
      <Dialog open={true} onClose={() => {}} footer={<button>Save</button>}>
        Content
      </Dialog>
    );
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });
});
