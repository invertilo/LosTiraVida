# Performance & Optimization Tips

This guide provides recommendations for maintaining and improving the Space Mission Simulator's performance.

## Current Performance Metrics

- **Bundle Size**: ~70KB gzipped (React + logic)
- **Build Time**: ~300ms
- **Target Lighthouse**: 90+ all metrics
- **Target Performance**: < 1.5s First Contentful Paint (FCP)

## Bundle Size Optimization

### Monitor Bundle Size

Track your bundle size regularly:

```bash
# Analyze current bundle size
npm run build:analyze

# Compare before/after changes
git stash
npm run build:analyze
git stash pop
npm run build:analyze
```

### Code Splitting Best Practices

The current configuration automatically splits React into a separate chunk:
- `react-vendor.js` - React + React DOM (~70KB gzipped)
- `index.js` - Application logic (~1.4KB gzipped)

This enables:
- **Browser caching**: React doesn't change often, so users can cache it
- **Parallel loading**: Multiple smaller files load faster
- **Lazy loading**: Load features on demand

### Adding More Code Splits

For large features (>50KB), consider lazy loading:

```javascript
// Instead of:
import MissionPlanner from './components/MissionPlanner'

// Use lazy loading:
const MissionPlanner = lazy(() => import('./components/MissionPlanner'))

// Then wrap in Suspense:
<Suspense fallback={<Loading />}>
  <MissionPlanner />
</Suspense>
```

### Dependency Analysis

Check for duplicate or unnecessary dependencies:

```bash
# List all dependencies and their sizes
npm ls

# Check for duplicate packages
npm dedupe

# Remove unused dependencies
npm prune
```

## Image & Asset Optimization

### SVG Images

SVG is already used for favicons. For other graphics:

```javascript
// Good: Small SVGs imported as components
import Logo from './icons/logo.svg'

// Use inline
<Logo width={32} height={32} />
```

### Raster Images (PNG/JPG)

If PNG/JPG images are added:

1. **Compress before adding**:
   - Use TinyPNG.com or similar
   - Target: < 50KB per image

2. **Use appropriate formats**:
   - Screenshots/photos: WebP or JPEG
   - Graphics with text: PNG
   - Icons: SVG

3. **Responsive images**:
   ```html
   <picture>
     <source srcset="image.webp" type="image/webp">
     <img src="image.jpg" alt="Description" loading="lazy">
   </picture>
   ```

4. **Lazy load images**:
   ```html
   <img src="image.jpg" alt="Description" loading="lazy">
   ```

## JavaScript Optimization

### Remove Console Statements in Production

The build automatically removes `console.log()` in production.

For other debug statements, use environment checks:

```javascript
// Development only
if (import.meta.env.DEV) {
  console.log('Debug info')
}

// Production only
if (import.meta.env.PROD) {
  console.log('Production info')
}
```

### Tree Shaking

Vite automatically removes unused code during build. To help:

1. **Use named imports**:
   ```javascript
   // Good: Tree-shakeable
   import { calculateOrbit } from './physics'
   
   // Avoid: May include entire module
   import * as physics from './physics'
   ```

2. **Keep modules small and focused**
3. **Mark side effects clearly** in package.json if needed

### Minimize Re-renders

In React components:

```javascript
// Use React.memo for expensive components
const MissionChart = React.memo(({ data }) => {
  return <svg>{/* rendering code */}</svg>
})

// Use useCallback for stable function references
const handleClick = useCallback(() => {
  // handler code
}, [])

// Use useMemo for expensive computations
const computedValue = useMemo(() => {
  return expensiveCalculation(data)
}, [data])
```

## CSS Optimization

### Tailwind CSS

The current setup with `@tailwindcss/vite` plugin provides:
- Automatic unused CSS removal (purge)
- CSS-in-JS optimization
- Smaller CSS output

**Keep Tailwind optimized**:
1. Only use Tailwind classes in JSX/HTML
2. Don't write raw CSS unless necessary
3. Avoid using `@apply` excessively

### CSS-in-JS

If needed, keep CSS-in-JS libraries to a minimum:
- **Styled-components**: ~15KB gzipped
- **CSS Modules**: Built into Vite, 0 bytes overhead

## Runtime Performance

### Core Web Vitals

Monitor these metrics:

1. **Largest Contentful Paint (LCP)**: < 2.5s
   - Optimize image loading
   - Reduce JavaScript execution time
   - Defer non-critical scripts

2. **First Input Delay (FID)**: < 100ms
   - Break up long JavaScript tasks
   - Use Web Workers for heavy computation
   - Prioritize user interactions

3. **Cumulative Layout Shift (CLS)**: < 0.1
   - Reserve space for images/ads
   - Avoid inserting content above existing content
   - Use CSS transforms instead of layout changes

### Monitoring

Use Lighthouse regularly:

```bash
# After building for production
npm run preview

# Open Chrome DevTools > Lighthouse
# Run audit
```

Target scores: 90+ for all metrics

## API & Network Optimization

### Reduce HTTP Requests

Group related requests:

```javascript
// Instead of multiple requests
const [planets, setplanets] = useState([])
const [spacecraft, setSpacecraft] = useState([])

useEffect(() => {
  fetch('/api/planets')
  fetch('/api/spacecraft')
}, [])

// Use a combined endpoint (if possible)
useEffect(() => {
  fetch('/api/mission-data')
}, [])
```

### Gzip Compression

Vercel automatically gzips responses. Ensure:
- Text files are gzipped (savings: 60-80%)
- Binary files aren't re-compressed
- Cache headers are set correctly

### Caching Strategy

Configure caching in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{
        "key": "Cache-Control",
        "value": "public, max-age=31536000, immutable"
      }]
    }
  ]
}
```

## Database & API Optimization

If adding backend services:

1. **Paginate results**: Don't fetch millions of records
2. **Implement caching**: Cache API responses with SWR/React Query
3. **Use CDN**: Serve static assets from CDN
4. **Optimize queries**: Add database indexes
5. **Rate limiting**: Prevent abuse

### Data Fetching Pattern

Use a data fetching library:

```javascript
// With SWR
import useSWR from 'swr'

function MissionData() {
  const { data, error } = useSWR('/api/missions', fetch)
  
  if (error) return <Error />
  if (!data) return <Loading />
  return <MissionList missions={data} />
}
```

## SEO Optimization

### Meta Tags

Already configured in `index.html`:
- ✓ Meta description
- ✓ Open Graph tags
- ✓ Twitter Card
- ✓ Viewport meta tag

### Sitemap & Robots

For production:

1. Create `public/robots.txt`:
   ```
   User-agent: *
   Allow: /
   Sitemap: https://yourdomain.com/sitemap.xml
   ```

2. Create `public/sitemap.xml`:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     <url>
       <loc>https://yourdomain.com/</loc>
     </url>
   </urlset>
   ```

## Development Server Optimization

### Vite Dev Server Speed

Vite is already optimized for development. To maximize speed:

1. **Use `npm run dev`** - HMR is already enabled
2. **Restart if needed** - Occasionally restart dev server
3. **Check file watchers** - Ensure no unnecessary file watching

### Large Project Optimization

If adding many files:

```javascript
// vite.config.js - optimize dev server
export default defineConfig({
  server: {
    // Exclude files from watching
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**']
    }
  }
})
```

## Performance Testing Checklist

Regular checks to perform:

- [ ] **Weekly**: Run Lighthouse, check scores
- [ ] **Weekly**: Check bundle size with `npm run build:analyze`
- [ ] **Before deploy**: Run full test suite
- [ ] **After deploy**: Check production Lighthouse
- [ ] **Monthly**: Review error logs, user analytics
- [ ] **Monthly**: Audit dependencies for updates

## Profiling & Debugging

### React DevTools Profiler

1. Install React DevTools browser extension
2. Open DevTools > Profiler tab
3. Record interactions
4. Identify slow components

### Chrome DevTools Performance

1. Open DevTools > Performance tab
2. Record page load or interaction
3. Analyze flame chart
4. Look for long tasks (>50ms)

### Lighthouse

1. Open DevTools > Lighthouse
2. Select metrics to audit
3. Run audit
4. Review report and fix issues

## Resources

- [Vite Performance Guide](https://vitejs.dev/guide/performance.html)
- [React Performance](https://react.dev/learn/render-and-commit)
- [Web.dev Performance](https://web.dev/performance/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [WebPageTest](https://www.webpagetest.org/)

## Performance Targets

**Current Configuration**:
- Bundle: ~70KB gzipped ✓ (target: <200KB)
- Build: ~300ms ✓ (target: <1 min)
- Lighthouse: Target 90+ on all metrics

**To Achieve & Maintain**:
1. Keep dependencies minimal
2. Monitor bundle size regularly
3. Use code splitting for large features
4. Optimize images and assets
5. Test on real devices periodically
6. Monitor real user metrics

---

For questions or performance issues, refer to:
- README.md - Project overview and setup
- SETUP.md - Detailed development guide
- DEPLOYMENT_CHECKLIST.md - Pre-deployment checks
