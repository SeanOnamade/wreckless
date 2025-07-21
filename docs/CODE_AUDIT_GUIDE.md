# Code Audit Guide

This document outlines a comprehensive approach to auditing code changes since the last commit. Use this guide to ensure code quality, security, and functionality before deploying changes.

## 1. **Review the Changes**

### **Git Commands**
```bash
# See what files have changed
git status

# See the actual changes in detail
git diff HEAD~1

# See a summary of changes
git diff --stat HEAD~1

# See changes in a specific file
git diff HEAD~1 -- path/to/file

# See commit history
git log --oneline -10
```

## 2. **Code Quality Checks**

### **Linting and Formatting**
```bash
# Run your project's linting rules
npm run lint

# Check for TypeScript errors
npm run type-check

# Format code (if using Prettier)
npm run format

# Check for unused imports/variables
npm run lint:fix
```

### **Static Analysis**
- Run any static analysis tools your project uses
- Check for security vulnerabilities with tools like `npm audit`
- Look for code complexity issues
- Use tools like SonarQube or CodeClimate if available

## 3. **Functional Testing**

### **Unit Tests**
```bash
# Run existing tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test files
npm test -- --testPathPattern=filename
```

### **Integration Tests**
- Test the specific features you've modified
- Verify API endpoints still work
- Check database migrations if applicable
- Test multiplayer functionality for game projects

## 4. **Manual Testing Checklist**

### **Core Functionality**
- [ ] Test the main user flows
- [ ] Verify no regressions in existing features
- [ ] Check edge cases and error handling
- [ ] Test on different browsers/devices if applicable
- [ ] Verify game mechanics still work (for game projects)

### **Performance**
- [ ] Check for obvious performance regressions
- [ ] Verify memory usage hasn't increased significantly
- [ ] Test loading times for affected features
- [ ] Monitor frame rate during gameplay (for game projects)

## 5. **Security Review**

### **Input Validation**
- Check that user inputs are properly validated
- Look for potential injection vulnerabilities
- Verify authentication/authorization logic
- Check for XSS vulnerabilities in web applications

### **Data Handling**
- Ensure sensitive data isn't exposed
- Check for proper error handling that doesn't leak information
- Verify API keys and secrets are properly secured
- Check for proper CORS configuration

## 6. **Documentation Review**

### **Code Documentation**
- [ ] Check that new functions/classes have proper JSDoc comments
- [ ] Verify README files are updated if needed
- [ ] Ensure API documentation is current
- [ ] Update any architecture diagrams if needed

### **Commit Messages**
- [ ] Review commit messages for clarity
- [ ] Ensure they follow your team's conventions
- [ ] Check that commits are atomic and focused

## 7. **Architecture Review**

### **Design Patterns**
- [ ] Check if changes follow established patterns
- [ ] Look for code duplication
- [ ] Verify separation of concerns
- [ ] Ensure proper abstraction levels

### **Dependencies**
- [ ] Review any new dependencies added
- [ ] Check if existing dependencies were updated
- [ ] Verify no unnecessary dependencies were added
- [ ] Check for security vulnerabilities in dependencies

## 8. **Three.js Specific Checks**

### **Best Practices**
- [ ] Check for proper object disposal to prevent memory leaks
- [ ] Verify no objects are being created in render loops
- [ ] Ensure proper use of `requestAnimationFrame`
- [ ] Check for efficient use of materials and geometries
- [ ] Verify proper use of `BufferGeometry` instead of `Geometry`

### **Performance Considerations**
- [ ] Verify frame rate is maintained
- [ ] Check for unnecessary draw calls
- [ ] Ensure proper use of instancing where applicable
- [ ] Check for proper frustum culling
- [ ] Verify LOD (Level of Detail) is implemented where needed

### **Asset Management**
- [ ] Verify models, textures, and audio still load properly
- [ ] Check for proper texture compression
- [ ] Ensure assets are optimized for web delivery
- [ ] Verify no broken asset references

## 9. **Automated Checks**

### **CI/CD Pipeline**
```bash
# If you have a CI pipeline, run it locally
npm run ci

# Or check what your CI would run
npm run build
npm run test
npm run lint
npm run type-check
```

### **Build Verification**
```bash
# Ensure the project builds successfully
npm run build

# Check for build warnings
npm run build -- --verbose

# Test production build
npm run build:prod
```

## 10. **Peer Review**

### **Code Review Process**
- Have another developer review your changes
- Use pull request reviews if working with a team
- Discuss any architectural decisions made
- Review for potential edge cases

### **Review Checklist**
- [ ] Code is readable and well-structured
- [ ] No obvious bugs or issues
- [ ] Performance considerations addressed
- [ ] Security implications considered
- [ ] Tests cover the new functionality

## 11. **Rollback Plan**

### **Emergency Procedures**
- [ ] Ensure you can quickly revert changes if needed
- [ ] Have a backup of the working state
- [ ] Test the rollback process
- [ ] Document rollback steps

### **Rollback Commands**
```bash
# Quick rollback to previous commit
git revert HEAD

# Hard reset to previous commit (use with caution)
git reset --hard HEAD~1

# Create a backup branch before making changes
git checkout -b backup-before-changes
```

## 12. **Final Checklist**

### **Pre-Deployment**
- [ ] All tests pass
- [ ] No linting errors
- [ ] Performance is acceptable
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Peer review completed
- [ ] Rollback plan ready
- [ ] Assets load correctly
- [ ] Game mechanics work (for game projects)
- [ ] Multiplayer functionality works (if applicable)

## **Quick Audit Script**

Create a script to automate some of these checks:

```bash
#!/bin/bash
echo "=== Code Audit Started ==="

echo "1. Checking git status..."
git status

echo "2. Running linting..."
npm run lint

echo "3. Running tests..."
npm test

echo "4. Building project..."
npm run build

echo "5. Security audit..."
npm audit

echo "6. Type checking..."
npm run type-check

echo "=== Code Audit Complete ==="
```

## **Project-Specific Considerations**

### **For Game Projects**
- Test all player abilities and mechanics
- Verify collision detection still works
- Check that audio plays correctly
- Ensure UI elements are responsive
- Test multiplayer synchronization

### **For Web Applications**
- Test responsive design on different screen sizes
- Verify accessibility features
- Check browser compatibility
- Test form submissions and validation

### **For API Projects**
- Test all endpoints with various inputs
- Verify error handling and status codes
- Check rate limiting and security headers
- Test authentication and authorization

## **Common Issues to Watch For**

### **Performance Issues**
- Memory leaks in Three.js applications
- Unnecessary re-renders
- Large bundle sizes
- Slow asset loading

### **Security Issues**
- Exposed API keys or secrets
- Unvalidated user input
- Missing authentication checks
- CORS misconfiguration

### **Code Quality Issues**
- Code duplication
- Overly complex functions
- Missing error handling
- Inconsistent naming conventions

## **Tools and Resources**

### **Recommended Tools**
- ESLint for JavaScript/TypeScript linting
- Prettier for code formatting
- Jest for testing
- npm audit for security
- Three.js Inspector for debugging 3D scenes
- Chrome DevTools for performance profiling

### **Useful Extensions**
- VS Code: ESLint, Prettier, GitLens
- Browser: Three.js Inspector, React DevTools
- Git: GitKraken, SourceTree

## **Emergency Procedures**

If critical issues are found during audit:

1. **Immediate Actions**
   - Stop deployment if in progress
   - Notify team members
   - Document the issue

2. **Investigation**
   - Identify root cause
   - Assess impact
   - Determine fix timeline

3. **Resolution**
   - Implement fix
   - Re-run audit
   - Deploy fix

4. **Post-Mortem**
   - Document what went wrong
   - Update audit process if needed
   - Implement preventive measures

---

*This guide should be updated regularly based on project needs and team feedback.* 