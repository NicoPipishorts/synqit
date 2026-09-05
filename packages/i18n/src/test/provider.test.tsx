import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useI18nContext } from '../context';
import { I18nProvider } from '../provider';

type Locale = 'en' | 'fr';
const dictionaries: Record<Locale, Record<string, unknown>> = {
  en: { greeting: 'Hello', onlyEn: 'Fallback text' },
  fr: { greeting: 'Bonjour' },
};

const Consumer = () => {
  const { locale, setLocale, t } = useI18nContext<Locale>();
  return (
    <div>
      <p data-testid="locale">{locale}</p>
      <p data-testid="greeting">{t('greeting')}</p>
      <p data-testid="fallback">{t('onlyEn')}</p>
      <button type="button" onClick={() => setLocale(locale === 'en' ? 'fr' : 'en')}>
        switch
      </button>
    </div>
  );
};

describe('I18nProvider', () => {
  it('renders synchronously with static dictionaries and switches locale', async () => {
    const onLocaleChange = vi.fn();
    render(
      <I18nProvider<Locale>
        initialLocale="en"
        fallbackLocale="en"
        loadMessages={(locale) => dictionaries[locale]}
        onLocaleChange={onLocaleChange}
      >
        <Consumer />
      </I18nProvider>,
    );
    expect(screen.getByTestId('greeting')).toHaveTextContent('Hello');

    await userEvent.click(screen.getByRole('button', { name: 'switch' }));
    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('fr'));
    expect(screen.getByTestId('greeting')).toHaveTextContent('Bonjour');
    expect(screen.getByTestId('fallback')).toHaveTextContent('Fallback text');
    expect(onLocaleChange).toHaveBeenCalledWith('fr');
  });

  it('shows the loading fallback until async dictionaries resolve', async () => {
    render(
      <I18nProvider<Locale>
        initialLocale="fr"
        fallbackLocale="en"
        loadMessages={(locale) => Promise.resolve(dictionaries[locale])}
        loadingFallback={<p>loading…</p>}
      >
        <Consumer />
      </I18nProvider>,
    );
    expect(screen.getByText('loading…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('greeting')).toHaveTextContent('Bonjour'));
  });

  it('throws when the hook is used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Consumer />)).toThrow(/inside I18nProvider/);
    spy.mockRestore();
  });
});
