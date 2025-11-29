# ESLint Configuration Guide

## Overview

ESLint is now configured for your Nexus React/Vite project. It will help you:
- Catch bugs before runtime
- Enforce consistent code style
- Fix React Hooks dependency issues
- Remove debug code (console.log statements)
- Follow React best practices

---

## Current Status

**ESLint Scan Results:**
- **Total Issues:** 431 problems found
- **Errors:** 20 (must fix)
- **Warnings:** 411 (should fix)
- **Auto-fixable:** 243 issues can be fixed automatically

---

## Quick Start

### Run ESLint to Check Code

```bash
npm run lint
```

### Auto-Fix Issues

```bash
npm run lint -- --fix
```

This will automatically fix:
- Quote style (single vs double quotes)
- Missing semicolons
- String concatenation to template literals
- Object shorthand
- And more...

---

## Common Issues Found

### 1. Unused React Import (61 files)
**Issue:** `'React' is defined but never used`

**Why:** React 17+ doesn't require `import React` for JSX

**Fix:** Remove unused React imports from files
```javascript
// Before
import React from 'react';

// After (if you're not using React.* anywhere)
// Just remove the line
```

**Auto-fix:** No, requires manual review

---

### 2. Console Statements (100+ occurrences)
**Issue:** `Unexpected console statement`

**Why:** console.log should not be in production code

**Fix:** Remove or conditionally enable
```javascript
// Remove
console.log('Debug info');

// Or make conditional
if (import.meta.env.DEV) {
  console.log('Debug info');
}

// console.warn and console.error are allowed
```

**Auto-fix:** No, requires manual decision

---

### 3. Quote Style (100+ occurrences)
**Issue:** `Strings must use singlequote`

**Why:** Consistency and ESLint preference

**Fix:** Change double quotes to single quotes
```javascript
// Before
const name = "John";

// After
const name = 'John';
```

**Auto-fix:** Yes - Run `npm run lint -- --fix`

---

### 4. Missing Semicolons
**Issue:** `Missing semicolon`

**Why:** Consistency and avoiding ASI issues

**Fix:** Add semicolons
```javascript
// Before
const name = 'John'

// After
const name = 'John';
```

**Auto-fix:** Yes - Run `npm run lint -- --fix`

---

### 5. Unescaped Entities (10+ occurrences)
**Issue:** `` `'` can be escaped with `&apos;` ``

**Why:** JSX requires HTML entity encoding

**Fix:** Escape apostrophes in JSX
```javascript
// Before
<p>Don't worry</p>

// After
<p>Don&apos;t worry</p>
// Or
<p>{"Don't worry"}</p>
```

**Auto-fix:** No, requires manual fix

---

### 6. Prefer Template Literals
**Issue:** `Unexpected string concatenation`

**Why:** Template literals are more readable

**Fix:** Use template literals
```javascript
// Before
const msg = 'Hello ' + name;

// After
const msg = `Hello ${name}`;
```

**Auto-fix:** Yes - Run `npm run lint -- --fix`

---

### 7. React Hooks Dependencies
**Issue:** `React Hook useEffect has missing dependencies`

**Why:** Can cause bugs with stale closures

**Fix:** Add missing dependencies or use useCallback
```javascript
// Before
useEffect(() => {
  loadData(clubId);
}, []); // Missing clubId

// After
useEffect(() => {
  loadData(clubId);
}, [clubId, loadData]); // Add dependencies
```

**Auto-fix:** No, requires understanding of code

---

### 8. Unused Variables
**Issue:** `'variable' is assigned a value but never used`

**Why:** Dead code

**Fix:** Remove unused variables or prefix with underscore
```javascript
// Option 1: Remove
// const unusedVar = 'test'; // Delete this

// Option 2: Prefix with _ if intentionally unused
const _unusedVar = 'test';
```

**Auto-fix:** No, requires manual review

---

## Step-by-Step Fix Guide

### Phase 1: Auto-Fix (5 minutes)

```bash
# Auto-fix 243 issues
npm run lint -- --fix
```

This fixes:
- Quotes
- Semicolons
- Template literals
- Object shorthand
- Spacing

### Phase 2: Manual Fixes (30-60 minutes)

#### Priority 1: Fix Errors (20 errors)
```bash
# See only errors
npm run lint -- --quiet
```

Main errors to fix:
- Unescaped entities (apostrophes in JSX)
- Unused eslint-disable directives in DevHelper.jsx

#### Priority 2: Remove Console Logs (100+ warnings)
Search and remove or conditionally enable:
```bash
# Find all console.log usage
grep -r "console.log" src/
```

#### Priority 3: Fix React Hooks (Important!)
Look for:
```
React Hook useEffect has missing dependencies
```

These can cause bugs! Add missing dependencies.

#### Priority 4: Remove Unused Imports
- Remove unused React imports from all files
- Remove other unused imports

---

## ESLint Commands Cheatsheet

```bash
# Check all files
npm run lint

# Auto-fix what can be fixed
npm run lint -- --fix

# Show only errors (ignore warnings)
npm run lint -- --quiet

# Lint specific file
npx eslint src/pages/Calendar.jsx

# Lint and fix specific file
npx eslint src/pages/Calendar.jsx --fix

# Lint with debug output
npm run lint -- --debug
```

---

## ESLint Rules Configured

### React Rules
- `react/prop-types: off` - PropTypes disabled (not using them)
- `react/jsx-uses-react: off` - Not needed in React 17+
- `react/react-in-jsx-scope: off` - Not needed in React 17+

### React Hooks Rules
- `react-hooks/rules-of-hooks: error` - Enforces Hook rules
- `react-hooks/exhaustive-deps: warn` - Checks dependencies

### Code Quality
- `no-console: warn` - Warns on console.log (allows warn/error)
- `no-unused-vars: warn` - Warns on unused variables
- `no-debugger: warn` - Warns on debugger statements
- `no-alert: warn` - Warns on alert/confirm/prompt

### Best Practices
- `eqeqeq: warn` - Requires === instead of ==
- `no-var: error` - Must use let/const
- `prefer-const: warn` - Use const when not reassigned
- `prefer-template: warn` - Use template literals

### Stylistic
- `quotes: warn` - Single quotes preferred
- `semi: warn` - Semicolons required

---

## Customizing Rules

Edit `.eslintrc.cjs` to change rules:

```javascript
rules: {
  // Make a rule more strict
  'no-console': 'error', // Change from 'warn' to 'error'
  
  // Disable a rule
  'prefer-template': 'off',
  
  // Change configuration
  'quotes': ['warn', 'double'], // Use double quotes instead
}
```

---

## Integration with VS Code

### Install ESLint Extension

1. Install "ESLint" extension by Microsoft
2. Restart VS Code
3. ESLint will now show inline errors

### Auto-fix on Save

Add to VS Code settings.json:
```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Lint Code
  run: npm run lint
```

### Pre-commit Hook (Optional)

Install husky and lint-staged:
```bash
npm install --save-dev husky lint-staged
npx husky init
```

---

## Troubleshooting

### Issue: ESLint not finding .eslintrc.cjs
**Solution:** Make sure you're in the project root directory

### Issue: Too many errors to fix
**Solution:** Fix incrementally:
1. Run `npm run lint -- --fix` first
2. Fix errors with `npm run lint -- --quiet`
3. Fix warnings gradually

### Issue: Rule seems wrong
**Solution:** You can disable specific rules in .eslintrc.cjs

---

## Next Steps

1. **Run auto-fix:**
   ```bash
   npm run lint -- --fix
   ```

2. **Fix critical errors:**
   ```bash
   npm run lint -- --quiet
   ```

3. **Remove console.log statements**
   - Replace with proper logging
   - Or conditionally enable for development

4. **Fix React Hooks dependencies**
   - Very important for preventing bugs
   - Review each useEffect carefully

5. **Clean up unused imports**
   - Remove unused React imports
   - Remove other unused variables

---

## Benefits After Cleanup

- Fewer bugs
- Consistent code style
- Better performance (no console.logs)
- Easier maintenance
- Better developer experience
- Passes CI/CD checks

---

Last Updated: 2025-11-28
