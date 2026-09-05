import { ThemeToggle as UiThemeToggle } from '@synqit/ui';

import { useTheme } from '../../hooks/useTheme';

/** App-bound ThemeToggle: wires the persisted theme preference. */
export const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();
  return <UiThemeToggle isDark={isDark} onToggle={toggleTheme} variant="surface" />;
};
