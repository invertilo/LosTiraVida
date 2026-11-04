# Deployment Checklist

Use this checklist to ensure your application is ready for production deployment.

## Pre-Deployment Testing

### Code Quality
- [ ] Run `npm run lint` - no errors or warnings
- [ ] Run `npm run type-check` - no type errors
- [ ] Review code for console.log and debugging statements
- [ ] Check for TODOs and FIXMEs

### Build Verification
- [ ] Run `npm run build` - builds successfully
- [ ] Build completes in under 1 minute
- [ ] Check bundle size is < 200KB gzipped (acceptable at ~70KB)
- [ ] Verify no errors or critical warnings during build

### Local Testing
- [ ] Run `npm run preview` - production build works locally
- [ ] Test all main features/pages work correctly
- [ ] Check that no console errors appear in DevTools
- [ ] Verify images and assets load correctly

### Responsive Design
- [ ] Test on desktop (1920x1080, 1366x768)
- [ ] Test on tablet (iPad: 768x1024, Android: 600x800)
- [ ] Test on mobile (iPhone: 375x667, Android: 360x640)
- [ ] Check text is readable on all screen sizes
- [ ] Verify touch interactions work on mobile

### Performance
- [ ] Run Lighthouse audit (target: 90+ all metrics)
  - [ ] Performance: 90+
  - [ ] Accessibility: 90+
  - [ ] Best Practices: 90+
  - [ ] SEO: 90+
- [ ] Check First Contentful Paint (FCP): < 1.5s
- [ ] Check Cumulative Layout Shift (CLS): < 0.1
- [ ] Check Core Web Vitals are passing

### Accessibility
- [ ] Run axe DevTools - no critical/serious issues
- [ ] Keyboard navigation works throughout app
- [ ] Screen reader works (NVDA/JAWS on Windows, VoiceOver on Mac)
- [ ] Color contrast is sufficient (≥ 4.5:1 for text)
- [ ] Images have meaningful alt text
- [ ] Form labels are properly associated
- [ ] Focus indicators are visible

### Browser Testing
- [ ] Chrome (latest version)
- [ ] Firefox (latest version)
- [ ] Safari (latest version)
- [ ] Edge (latest version)
- [ ] Safari on iOS
- [ ] Chrome on Android

### Security
- [ ] No sensitive data in environment variables exposed to browser
- [ ] API keys properly configured
- [ ] No hardcoded credentials in code
- [ ] HTTPS enabled on production domain
- [ ] CORS headers configured correctly (if needed)
- [ ] CSP headers configured properly

### SEO
- [ ] Title tag is descriptive and unique
- [ ] Meta description set appropriately
- [ ] Open Graph tags configured (og:title, og:description, og:image)
- [ ] Twitter Card meta tags added
- [ ] Favicon appears correctly in browser tab
- [ ] robots.txt is configured (if needed)
- [ ] sitemap.xml is created (if needed)

## Deployment to Vercel

### Pre-Deployment
- [ ] All items above are completed
- [ ] Commit all changes to Git
- [ ] Create a clean working directory (no uncommitted changes)

### Vercel Setup (First Time Only)
- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] Login to Vercel: `vercel login`
- [ ] Link project: `vercel link`

### Environment Variables
- [ ] Create `.env.local` with required variables
- [ ] Add variables to Vercel dashboard if needed:
  - Go to Project Settings > Environment Variables
  - Add each required variable
  - Select which environments (Production, Preview, Development)

### Deploy to Preview
```bash
# Deploy to preview environment
vercel
```
- [ ] Check preview URL works
- [ ] Verify all features work in preview
- [ ] Check that images load correctly
- [ ] Verify API calls work if applicable

### Deploy to Production
```bash
# Deploy to production
vercel --prod
```
- [ ] Confirm production deployment was successful
- [ ] Wait 1-2 minutes for DNS propagation
- [ ] Visit production URL and verify it works
- [ ] Run final Lighthouse audit on production URL
- [ ] Test all major features once more

### Post-Deployment
- [ ] Monitor error tracking (if setup)
- [ ] Check deployment logs for warnings/errors
- [ ] Verify analytics tracking (if setup)
- [ ] Test email notifications (if setup)
- [ ] Share deployed URL with team/stakeholders
- [ ] Update any documentation with live URL

## Rollback Procedure

If issues are found in production:

1. **Quick Rollback** (if recent commit):
   ```bash
   git revert HEAD
   git push origin main
   # Vercel will auto-deploy the reverted code
   ```

2. **Vercel Dashboard Rollback**:
   - Go to Vercel Dashboard > Deployments
   - Find the previous stable deployment
   - Click "..." menu > "Promote to Production"

3. **Manual Rollback**:
   ```bash
   vercel rollback
   ```

## Monitoring

After deployment, monitor:

- [ ] Real User Monitoring (RUM) data
- [ ] Error tracking dashboard
- [ ] API response times
- [ ] Server error rates
- [ ] User session data (if tracking)

## Version Management

- [ ] Update version in `package.json`
- [ ] Create Git tag: `git tag v1.0.0`
- [ ] Push tag: `git push origin v1.0.0`
- [ ] Document changes in CHANGELOG.md

## Useful Commands

```bash
# Test production build locally
npm run build && npm run preview

# Analyze bundle size
npm run build:analyze

# View deployment logs
vercel logs --prod

# Check deployment status
vercel status

# List all deployments
vercel list

# View specific deployment details
vercel inspect <deployment-url>
```

## Common Issues & Fixes

### Build Fails After Deployment
- Check environment variables are set in Vercel dashboard
- Verify all dependencies are in package.json (not just package-lock.json)
- Check Node.js version compatibility
- Clear build cache and redeploy

### Performance Issues in Production
- Run Lighthouse audit
- Check bundle size growth
- Verify images are optimized
- Check for N+1 API calls
- Review server response times

### Mobile Issues After Deployment
- Test on real devices, not just DevTools emulation
- Check viewport meta tag in HTML
- Verify touch interactions work
- Check mobile-specific CSS

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [React Performance Best Practices](https://react.dev/learn/render-and-commit)
- [Web.dev Performance Audit](https://web.dev/measure/)
- [MDN Web Docs](https://developer.mozilla.org/)

---

**Date Deployed**: _______________
**Deployed By**: _______________
**Notes**: 

