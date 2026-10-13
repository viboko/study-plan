import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import yml from 'eslint-plugin-yml';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{js,ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  ...yml.configs['flat/standard'],
  {
    // A bare `pull_request:` (no value) is the standard GitHub Actions
    // syntax for "default event types", not a mistake.
    files: ['.github/workflows/**/*.{yml,yaml}'],
    rules: {
      'yml/no-empty-mapping-value': 'off',
    },
  },
);
