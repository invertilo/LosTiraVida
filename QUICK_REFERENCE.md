# Quick Reference Guide

Fast lookup for common commands and workflows.

## Development Commands

```bash
# Start development server
npm run dev

# Run linter
npm run lint

# Check TypeScript
npm run type-check

# Build for production
npm run build

# Preview production build
npm run preview

# Analyze bundle size
npm run build:analyze
```

## Project URLs

| Environment | URL |
|-------------|-----|
| Local Dev | http://localhost:5173 |
| Local Preview | Run `npm run preview` then http://localhost:4173 |
| Production | https://your-domain.vercel.app |

## File Structure Quick Guide

| File/Folder | Purpose |
|---|---|
| `src/main.jsx` | React entry point |
| `src/App.jsx` | Main app component |
| `src/components/` | Reusable React components |
| `src/engine/` | Simulation logic and physics |
| `src/hooks/` | Custom React hooks |
| `src/assets/` | Images, SVGs, data files |
| `vite.config.js` | Vite build configuration |
| `tailwind.config.js` | Tailwind CSS configuration |
| `tsconfig.json` | TypeScript configuration |
| `package.json` | Dependencies and scripts |
| `vercel.json` | Vercel deployment config |
| `public/` | Static files (favicon, icons) |
| `dist/` | Production build output |

## Deployment Quick Start

### Deploy to Vercel

```bash
# First time setup
npm i -g vercel
vercel login
vercel link

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Check Deployment Status

```bash
# View all deployments
vercel list

# Check production status
vercel status

# View deployment logs
vercel logs --prod
```

## Troubleshooting Quick Guide

| Issue | Solution |
|-------|----------|
| Build fails | `npm install` then `npm run build` |
| Dev server won't start | Kill process: `lsof -i :5173 \| grep node \| awk '{print $2}' \| xargs kill` |
| Large bundle size | Run `npm run build:analyze` and check dependencies |
| Console errors in dev | Check browser DevTools, ensure all imports are correct |
| TypeScript errors | Run `npm run type-check` to see full error list |
| Style issues | Check Tailwind classes, run `npm run build` to test |

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Bundle (gzipped) | < 200KB | ~70KB ✓ |
| Build time | < 1 min | ~300ms ✓ |
| Lighthouse Score | 90+ | Target 90+ |
| FCP | < 1.5s | Measure with Lighthouse |
| CLS | < 0.1 | Measure with Lighthouse |

## IDE Setup

### VS Code Extensions (Recommended)

```
bradlc.vscode-tailwindcss
dsznajder.es7-react-js-snippets
esbenp.prettier-vscode
Boshen.oxlint
```

### Quick Settings

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

## Git Workflow

```bash
# Check status
git status

# Create branch for feature
git checkout -b feature/my-feature

# Stage changes
git add .

# Commit changes
git commit -m "Add feature description"

# Push to remote
git push origin feature/my-feature

# Create pull request on GitHub
```

## Documentation Files

| Document | Purpose |
|----------|---------|
| README.md | Project overview and setup |
| SETUP.md | Detailed development guide |
| DEPLOYMENT_CHECKLIST.md | Pre-deployment verification |
| OPTIMIZATION_TIPS.md | Performance optimization guide |
| QUICK_REFERENCE.md | This file - quick lookups |

## Environment Variables

### Required Variables (if any)

See `.env.example` for template.

```bash
# Copy template
cp .env.example .env.local

# Edit with your values
nano .env.local

# For Vercel, add via dashboard:
# Project Settings > Environment Variables
```

## Common Config Changes

### Add New Component

1. Create `src/components/MyComponent.jsx`
2. Import in parent: `import MyComponent from './components/MyComponent'`
3. Use in JSX: `<MyComponent />`

### Add New Page/Route

1. Create component in `src/components/Pages/MyPage.jsx`
2. Import and add to routing logic
3. Update navigation if needed

### Change Colors

Edit `tailwind.config.js` in the `theme.extend.colors` section.

### Add Third-Party Library

```bash
# Install package
npm install package-name

# Add to app
import Package from 'package-name'

# Run build to verify
npm run build
```

## Browser DevTools Tips

### Performance Profiling

1. Open DevTools: F12 (Windows) or Cmd+Option+I (Mac)
2. Go to Performance tab
3. Click record, interact with app, stop recording
4. Analyze flame chart for bottlenecks

### React Component Debugging

1. Install React DevTools extension
2. Open DevTools > Components tab
3. Inspect component tree and props
4. Use Profiler to find slow renders

### Network Issues

1. DevTools > Network tab
2. Check status codes (200, 304, 404, etc.)
3. Look for slow requests
4. Check caching headers

## Lighthouse Audit

```bash
# Build and preview
npm run build
npm run preview

# Chrome DevTools > Lighthouse
# Click "Analyze page load"
```

**Target scores**: 90+ for all categories

## Build Artifacts

After running `npm run build`, check `dist/` directory:

```
dist/
├── index.html          # Main HTML file
├── assets/
│   ├── index-*.js      # App logic
│   ├── index-*.css     # Styles
│   └── react-vendor-*.js  # React bundle
└── favicon.svg         # Favicon
```

## Common Mistakes to Avoid

- Don't commit `.env.local` files (add to `.gitignore`)
- Don't import entire modules when only 1 export needed
- Don't forget to test on mobile devices
- Don't skip the deployment checklist before going live
- Don't modify `dist/` folder directly (it's generated)
- Don't keep console.log statements in production code

## Need Help?

1. Check relevant documentation file:
   - README.md - General questions
   - SETUP.md - Development setup
   - DEPLOYMENT_CHECKLIST.md - Before deploying
   - OPTIMIZATION_TIPS.md - Performance questions

2. Search online for specific error messages

3. Check browser console for errors: F12 > Console tab

4. Ask AI assistant with specific error message

---

**Last Updated**: 2026-11-04

Keep this file bookmarked for quick reference during development!
