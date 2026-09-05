import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Modal } from '../../components/Modal';

describe('Modal', () => {
  it('renders nothing when closed and a dialog when open', async () => {
    const { rerender } = render(
      <Modal open={false} title="Details" onClose={() => undefined} closeLabel="Close">
        body
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <Modal open title="Details" onClose={() => undefined} closeLabel="Close">
        body
      </Modal>,
    );
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Details' })).toBeInTheDocument(),
    );
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('closes on Escape and on the close controls', async () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Details" onClose={onClose} closeLabel="Close">
        body
      </Modal>,
    );
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    expect(closeButtons.length).toBeGreaterThanOrEqual(2);
    await userEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
