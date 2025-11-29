module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: '18.2',
    },
  },
  plugins: ['react-refresh'],
  rules: {
    // React Refresh
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],

    // React Rules
    'react/prop-types': 'off', // Turn off if not using PropTypes
    'react/jsx-uses-react': 'off', // Not needed in React 17+
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+

    // React Hooks Rules (IMPORTANT)
    'react-hooks/rules-of-hooks': 'error', // Checks rules of Hooks
    'react-hooks/exhaustive-deps': 'warn', // Checks effect dependencies

    // Code Quality
    'no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    'no-console': ['warn', { 
      allow: ['warn', 'error'] 
    }], // Warn on console.log, allow console.warn/error
    'no-debugger': 'warn',
    'no-alert': 'warn',

    // Best Practices
    'eqeqeq': ['warn', 'always'], // Require === and !==
    'no-var': 'error', // Require let/const instead of var
    'prefer-const': 'warn', // Prefer const when not reassigned
    'prefer-template': 'warn', // Prefer template literals
    'object-shorthand': 'warn', // Prefer object shorthand
    'no-duplicate-imports': 'error', // Disallow duplicate imports

    // Potential Errors
    'no-await-in-loop': 'warn',
    'no-constant-condition': 'warn',
    'no-template-curly-in-string': 'warn',
    
    // Stylistic (Light enforcement)
    'quotes': ['warn', 'single', { avoidEscape: true }],
    'semi': ['warn', 'always'],
  },
};
