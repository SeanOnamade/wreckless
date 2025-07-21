# Automated Tooling Setup Guide

This document outlines how to set up various automated tools for code quality, testing, performance monitoring, and CI/CD for the project.

## **1. ESLint Setup**

### **Installation**
```bash
# Install ESLint and TypeScript support
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### **Configuration (.eslintrc.json)**
```json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "rules": {
    "no-unused-vars": "error",
    "no-console": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "no-new-in-loops": "error",
    "prefer-const": "error",
    "no-var": "error"
  },
  "ignorePatterns": ["dist/", "node_modules/", "*.js"]
}
```

### **Three.js Specific Rules**
```json
{
  "rules": {
    "no-new-in-loops": "error",
    "prefer-const": "error",
    "no-var": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  }
}
```

### **Package.json Scripts**
```json
{
  "scripts": {
    "lint": "eslint src/**/*.{ts,tsx}",
    "lint:fix": "eslint src/**/*.{ts,tsx} --fix"
  }
}
```

## **2. Prettier Setup**

### **Installation**
```bash
npm install --save-dev prettier
```

### **Configuration (.prettierrc)**
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

### **Ignore File (.prettierignore)**
```
dist/
node_modules/
*.min.js
*.bundle.js
public/
```

### **Package.json Scripts**
```json
{
  "scripts": {
    "format": "prettier --write src/**/*.{ts,tsx,js,jsx,json,css,md}",
    "format:check": "prettier --check src/**/*.{ts,tsx,js,jsx,json,css,md}"
  }
}
```

## **3. Unit Testing with Vitest**

### **Installation**
```bash
npm install --save-dev vitest @vitest/ui jsdom @testing-library/jest-dom
```

### **Vite Config Update (vite.config.js)**
```javascript
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts']
  },
})
```

### **Test Setup File (src/test/setup.ts)**
```typescript
import '@testing-library/jest-dom'

// Mock Three.js for testing
global.THREE = {
  WebGLRenderer: jest.fn(),
  Scene: jest.fn(),
  PerspectiveCamera: jest.fn(),
  // Add other Three.js mocks as needed
};
```

### **Example Test Structure**
```
src/
├── __tests__/
│   ├── components/
│   │   ├── Player.test.ts
│   │   └── Combat.test.ts
│   ├── utils/
│   │   └── mathUtils.test.ts
│   └── integration/
│       └── gameFlow.test.ts
```

### **Package.json Scripts**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:run": "vitest run"
  }
}
```

## **4. Performance Testing**

### **Lighthouse Integration**
```bash
npm install --save-dev lighthouse chrome-launcher
```

### **Performance Test Script (scripts/performance.js)**
```javascript
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');

async function runLighthouse() {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox']
  });
  
  const options = {
    logLevel: 'info',
    output: 'html',
    port: chrome.port,
    onlyCategories: ['performance']
  };
  
  const runnerResult = await lighthouse('http://localhost:5173', options);
  
  // Save report
  fs.writeFileSync('performance-report.html', runnerResult.report);
  
  const score = runnerResult.lhr.categories.performance.score * 100;
  console.log(`Performance score: ${score}`);
  
  await chrome.kill();
  
  if (score < 80) {
    console.error('Performance score below threshold!');
    process.exit(1);
  }
}

runLighthouse().catch(console.error);
```

### **Bundle Analysis**
```bash
npm install --save-dev rollup-plugin-visualizer
```

### **Vite Config Update for Bundle Analysis**
```javascript
import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          rapier: ['@dimforge/rapier3d'],
        }
      }
    }
  }
})
```

## **5. Security Scanning**

### **Built-in npm audit**
```bash
npm audit
npm audit --audit-level high
```

### **Enhanced Security Tools**
```bash
npm install --save-dev audit-ci
```

### **Security Script (scripts/security.js)**
```javascript
const { execSync } = require('child_process');

function runSecurityChecks() {
  console.log('Running security audit...');
  
  try {
    execSync('npm audit --audit-level high', { stdio: 'inherit' });
    console.log('✓ No high-severity vulnerabilities found');
  } catch (error) {
    console.error('✗ Security vulnerabilities detected');
    process.exit(1);
  }
  
  // Check for hardcoded secrets
  try {
    execSync('grep -r "api[_-]key\\|secret\\|password\\|token" src/ --exclude-dir=node_modules || true', { stdio: 'inherit' });
  } catch (error) {
    // grep returns non-zero when no matches found, which is good
  }
}

runSecurityChecks();
```

## **6. Pre-commit Hooks**

### **Installation**
```bash
npm install --save-dev husky lint-staged
```

### **Setup**
```bash
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

### **Package.json Configuration**
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "git add"
    ],
    "*.{js,jsx,json,css,md}": [
      "prettier --write",
      "git add"
    ]
  }
}
```

## **7. Enhanced TypeScript Configuration**

### **Stricter tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Enhanced Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

## **8. Comprehensive Audit Script**

### **Create scripts/audit.js**
```javascript
const { execSync } = require('child_process');

function runCommand(command, description) {
  console.log(`\n=== ${description} ===`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✓ ${description} passed`);
    return true;
  } catch (error) {
    console.error(`✗ ${description} failed`);
    return false;
  }
}

function runAudit() {
  console.log('🔍 Starting comprehensive code audit...\n');
  
  const checks = [
    ['git status --porcelain', 'Git Status Check'],
    ['npm run lint', 'ESLint Check'],
    ['npm run format:check', 'Prettier Check'],
    ['npx tsc --noEmit', 'TypeScript Check'],
    ['npm run test:run', 'Unit Tests'],
    ['npm run build', 'Build Check'],
    ['npm audit --audit-level high', 'Security Audit'],
    ['node scripts/performance.js', 'Performance Check']
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const [command, description] of checks) {
    if (runCommand(command, description)) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log(`\n📊 Audit Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('❌ Audit failed - please fix issues before deploying');
    process.exit(1);
  } else {
    console.log('✅ All checks passed - ready for deployment!');
  }
}

runAudit();
```

### **Package.json Scripts**
```json
{
  "scripts": {
    "audit": "node scripts/audit.js",
    "audit:quick": "npm run lint && npm run format:check && npx tsc --noEmit",
    "pre-deploy": "npm run audit"
  }
}
```

## **9. CI/CD Integration**

### **GitHub Actions (.github/workflows/ci.yml)**
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Check formatting
      run: npm run format:check
    
    - name: Run type checking
      run: npx tsc --noEmit
    
    - name: Run tests
      run: npm run test:run
    
    - name: Run security audit
      run: npm audit --audit-level high
    
    - name: Build project
      run: npm run build
    
    - name: Upload build artifacts
      uses: actions/upload-artifact@v3
      with:
        name: dist-files
        path: dist/

  performance:
    runs-on: ubuntu-latest
    needs: test
    
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18.x'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build project
      run: npm run build
    
    - name: Start server
      run: npm run preview &
    
    - name: Wait for server
      run: sleep 10
    
    - name: Run performance tests
      run: node scripts/performance.js
```

## **Implementation TODO List**

### **High Priority**
- [ ] Set up ESLint with TypeScript support and Three.js specific rules
- [ ] Configure Prettier for consistent code formatting
- [ ] Update TypeScript config with stricter checking rules
- [ ] Add bundle size analysis with rollup-plugin-visualizer

### **Medium Priority**
- [ ] Install and configure Vitest for unit testing
- [ ] Create example unit tests for key components (Player, Combat, etc.)
- [ ] Configure husky and lint-staged for pre-commit checks
- [ ] Create comprehensive audit script that runs all checks

### **Lower Priority**
- [ ] Create automated performance testing script
- [ ] Create GitHub Actions workflow for automated CI/CD
- [ ] Set up advanced security scanning tools
- [ ] Create performance monitoring dashboard

### **Nice to Have**
- [ ] Set up code coverage reporting
- [ ] Add visual regression testing
- [ ] Configure automatic dependency updates
- [ ] Set up error tracking and monitoring

## **Getting Started**

1. **Quick Setup** (Essential tools):
   ```bash
   npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier
   # Create .eslintrc.json and .prettierrc
   # Add scripts to package.json
   ```

2. **Testing Setup**:
   ```bash
   npm install --save-dev vitest @vitest/ui jsdom
   # Update vite.config.js
   # Create test examples
   ```

3. **Full Automation**:
   ```bash
   npm install --save-dev husky lint-staged
   npx husky install
   # Create audit script
   # Set up CI/CD pipeline
   ```

## **Maintenance**

- **Weekly**: Run `npm audit` and update dependencies
- **Before releases**: Run full audit script
- **Monthly**: Review and update linting rules
- **Quarterly**: Update testing strategies and performance benchmarks

---

*This document should be updated as tools are implemented and requirements evolve.* 