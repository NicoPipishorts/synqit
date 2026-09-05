import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ToastProvider } from '../../components/ToastProvider';
import { useToast } from '../../hooks/useToast';

const Trigger = () => {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast('Saved!', { variant: 'success' })}>
      notify
    </button>
  );
};

describe('ToastProvider', () => {
  it('shows a toast, lets the user dismiss it, and auto-expires', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider dismissLabel="Dismiss">
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'notify' }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved!');

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'notify' }));
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('throws when useToast is used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Trigger />)).toThrow(/within ToastProvider/);
    spy.mockRestore();
  });
});
