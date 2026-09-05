import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CTAAnchor, CTAButton, ctaClassName } from '../../components/cta';

describe('CTA', () => {
  it('renders a button with the variant classes and defaults to type=button', () => {
    render(<CTAButton variant="primary">Save</CTAButton>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toContain('bg-brand-lime');
  });

  it('exposes the class list for router links', () => {
    expect(ctaClassName('danger', 'lg', false)).toContain('bg-brand-pink');
    expect(ctaClassName('danger', 'lg', false)).not.toContain('shadow-soft-lift');
  });

  it('blocks navigation on a disabled anchor', async () => {
    const onClick = vi.fn();
    render(
      <CTAAnchor href="/somewhere" disabled onClick={onClick}>
        Go
      </CTAAnchor>,
    );
    const anchor = screen.getByRole('link', { name: 'Go' });
    expect(anchor).toHaveAttribute('aria-disabled', 'true');
    expect(anchor).toHaveAttribute('tabindex', '-1');
    await userEvent.click(anchor, { pointerEventsCheck: 0 });
    expect(onClick).not.toHaveBeenCalled();
  });
});
