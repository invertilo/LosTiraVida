# Deployment Guide

Deploy the Space Mission Simulator to production with a single command.

## Quick Start (One-Command Deployment)

### First Time Setup

```bash
# Install Vercel CLI globally (one-time)
npm i -g vercel

# Login to your Vercel account
vercel login

# Link this project to Vercel
vercel link
```

### Deploy to Production

```bash
# One-command deploy to production
vercel --prod
```

That's it! Your app will be live at `https://your-project.vercel.app`

## Pre-Deployment Checklist

Before deploying, verify these items:

```bash
# 1. Run tests
npm test

# 2. Check TypeScript
npm run type-check

# 3. Run linter
npm run lint

# 4. Build locally
npm run build

# 5. Test production build
npm run preview
```

**Note**: All checks above should pass with 0 errors/warnings.

## Deployment Options

### Option 1: Vercel CLI (Recommended)

```bash
# Install CLI (first time only)
npm i -g vercel

# Login
vercel login

# Deploy to preview environment
vercel

# Deploy to production
vercel --prod

# View deployment status
vercel status

# View deployment logs
vercel logs --prod
```

### Option 2: GitHub Integration

1. Push code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-url>
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "New Project"
4. Select your GitHub repository
5. Click "Deploy"

Each push to `main` branch will automatically deploy to production.

### Option 3: Drag & Drop

1. Go to [vercel.com](https://vercel.com)
2. Drag and drop the `dist/` folder to the drop zone
3. Your app deploys instantly

## Environment Variables

If your app needs environment variables:

1. Create `.env.local` file:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values
   ```

2. In Vercel Dashboard:
   - Go to Project Settings > Environment Variables
   - Add your variables
   - Redeploy for changes to take effect

## Build Configuration

The project automatically configures itself for Vercel:

- **Framework**: Vite (auto-detected)
- **Build Command**: `npm run build`
- **Output Directory**: `dist/`
- **Install Command**: `npm install`

No configuration needed - Vercel handles it automatically!

## Post-Deployment

### Verify Deployment

```bash
# Test the live URL
vercel inspect <deployment-url>

# View deployment details
vercel list

# Check specific deployment
vercel inspect <deployment-url>
```

### Monitor Performance

1. **Lighthouse Audit**:
   - Go to your live URL
   - Open DevTools (F12)
   - Lighthouse > Generate Report
   - Target: 90+ on all metrics

2. **Web Vitals**:
   - Check Core Web Vitals scores
   - Target: LCP < 2.5s, FID < 100ms, CLS < 0.1

3. **Vercel Analytics** (optional):
   - Enable in Project Settings > Analytics
   - View real-time performance data

## Troubleshooting

### Build Fails After Deployment

**Solution**:
```bash
# Clear cache and redeploy
vercel --prod --skip-build
# OR
# Inspect build logs in Vercel dashboard
vercel logs --prod
```

### Performance Issues

**Check**:
1. Run `npm run build:analyze` to see bundle size
2. Verify no large images or files in `public/`
3. Check for unnecessary dependencies

**Example**:
```bash
npm run build:analyze
# Look for large modules and remove if unused
npm uninstall <unused-dependency>
npm run build
vercel --prod
```

### Old Deployment Still Live

**Solution**: Use Vercel Dashboard to promote stable deployments:
1. Go to Deployments tab
2. Find the working deployment
3. Click "..." menu
4. Select "Promote to Production"

### Environment Variables Not Working

**Check**:
1. Variables are set in Vercel Dashboard (Project Settings > Environment Variables)
2. Variable names match your code (`process.env.REACT_APP_*`)
3. You've redeployed after adding variables

**Solution**:
```bash
vercel link
vercel env pull
vercel --prod --skip-build
```

## Rollback Procedure

If something breaks in production:

### Quick Rollback (Vercel Dashboard)

1. Go to [vercel.com](https://vercel.com)
2. Navigate to your project
3. Go to "Deployments" tab
4. Find the previous stable deployment
5. Click "..." menu
6. Select "Promote to Production"

### Using Vercel CLI

```bash
# View recent deployments
vercel list

# Rollback to specific deployment
vercel promote <deployment-url>
```

### Manual Rollback (via Git)

```bash
# Revert last commit
git revert HEAD
git push origin main

# Vercel will auto-redeploy (if using Git integration)
```

## Security Best Practices

1. **No Secrets in Code**:
   - Never commit API keys or tokens
   - Use environment variables only
   - Keep `.env.local` in `.gitignore`

2. **HTTPS Enabled**:
   - Vercel enforces HTTPS automatically
   - All connections are encrypted

3. **Content Security Policy**:
   - Review CSP headers in `vercel.json`
   - Ensure only trusted sources are allowed

## Custom Domain

Add a custom domain to your Vercel deployment:

1. Go to Project Settings > Domains
2. Add your domain (e.g., `myapp.com`)
3. Update your DNS records (follow Vercel's instructions)
4. Wait 1-2 minutes for DNS propagation
5. Vercel auto-provisions SSL certificate

## CI/CD with GitHub Actions

Set up automatic testing and deployment:

Create `.github/workflows/deploy.yml`:

```yaml
name: Test & Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

Then set up secrets in GitHub:
1. Go to Settings > Secrets > Actions
2. Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
3. Commit the workflow file
4. All future pushes auto-deploy after tests pass!

## Deployment Commands Reference

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Check deployment status
vercel status

# View live site
vercel env pull && npm run dev

# Inspect deployment
vercel inspect <url>

# View logs
vercel logs <url>
vercel logs --prod

# List deployments
vercel list

# Promote to production
vercel promote <deployment-url>

# Remove deployment
vercel remove <deployment-url>

# Link project
vercel link

# Unlink project
vercel unlink
```

## Performance Targets

After deployment, verify:

- **Lighthouse Score**: 90+ (Performance, Accessibility, SEO, Best Practices)
- **Bundle Size**: < 200KB gzipped
- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Cumulative Layout Shift (CLS)**: < 0.1

## Monitoring & Analytics

### View Real-Time Stats

```bash
# Tail production logs
vercel logs --prod --follow

# View all deployments
vercel list

# Check current status
vercel status
```

### Set Up Alerts

1. Go to Project Settings > Integrations
2. Add monitoring tool (e.g., Sentry, DataDog)
3. Enable alerts for errors and performance issues

## Support & Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Build Guide](https://vitejs.dev/guide/build.html)
- [React Performance Guide](https://react.dev/learn/render-and-commit)
- [Web Vitals](https://web.dev/vitals/)

---

**Ready to launch?** Run `vercel --prod` and celebrate! 🚀
