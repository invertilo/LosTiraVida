# Development Setup Guide

This guide provides detailed instructions for setting up the Space Mission Simulator for development.

## System Requirements

### Minimum Requirements

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher (comes with Node.js)
- **RAM**: 4GB minimum
- **Disk Space**: 2GB for node_modules and dist

### Recommended Setup

- **Node.js**: v20 LTS or higher
- **npm**: v10 or higher
- **RAM**: 8GB or more
- **SSD**: For faster builds and development

## Installation Steps

### 1. Verify Prerequisites

Check your Node.js and npm versions:

```bash
node --version  # Should be v18.0.0+
npm --version   # Should be v9.0.0+
```

If you need to install or update Node.js:
- **macOS**: `brew install node@20`
- **Windows**: Download from [nodejs.org](https://nodejs.org/)
- **Linux**: Follow distribution-specific instructions

### 2. Clone the Repository

```bash
git clone <repository-url>
cd LosTiraVida
```

### 3. Install Dependencies

```bash
npm install
```

This will install all packages listed in `package.json`:
- React 19.3 and React DOM
- Vite build tool
- Tailwind CSS
- TypeScript
- Development tools (Oxlint, etc.)

### 4. Verify Installation

```bash
# Check that all dependencies are installed
npm list

# Run linting to verify setup
npm run lint

# Check for type errors
npm run type-check
```

## Development Workflow

### Starting the Development Server

```bash
npm run dev
```

This will:
1. Start a Vite dev server (usually at `http://localhost:5173`)
2. Enable Hot Module Replacement (HMR) for instant code updates
3. Show file change notifications in the terminal

### Code Quality

#### Linting

Check code for quality issues:

```bash
npm run lint
```

Fix some issues automatically:

```bash
npm run lint -- --fix
```

#### Type Checking

```bash
npm run type-check
```

This validates TypeScript types without building.

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` folder:
- Minified JavaScript
- Optimized CSS
- Hashed file names for caching
- Code splitting for better performance

### Testing the Production Build

```bash
npm run build
npm run preview
```

This builds the app and serves the production build locally for testing.

## Project Configuration Files

### vite.config.js

Configures the Vite build tool:
- React plugin setup
- Build optimization settings
- Development server options
- Code splitting configuration

See `/Users/ice/LosTiraVida/vite.config.js`

### tailwind.config.js

Tailwind CSS configuration:
- Custom color palette (neutral colors extended)
- Typography scale
- Spacing scale
- Custom fonts

See `/Users/ice/LosTiraVida/tailwind.config.js`

### tailwind.css / postcss.config.js

PostCSS processes Tailwind directives:
- Autoprefixer adds vendor prefixes
- Tailwind generates utility classes

### package.json

Defines project metadata, dependencies, and scripts.

Key fields:
- `scripts`: Available npm commands
- `dependencies`: Runtime dependencies (React, React DOM)
- `devDependencies`: Build and development tools

## Environment Variables

### Setting Up Environment Variables

1. Create `.env.local` in the project root:

```bash
cp .env.example .env.local
```

2. Edit `.env.local` with your values:

```env
VITE_API_KEY=your_api_key_here
VITE_API_ENDPOINT=https://api.example.com
```

### Important Notes

- Environment variables prefixed with `VITE_` are accessible in the browser
- Never commit `.env.local` or `.env` files to version control
- Use `.env.example` as a template for required variables

## IDE Setup

### VS Code (Recommended)

#### Recommended Extensions

1. **ES7+ React/Redux/React-Native snippets**
   - `dsznajder.es7-react-js-snippets`

2. **Tailwind CSS IntelliSense**
   - `bradlc.vscode-tailwindcss`

3. **Oxlint (JavaScript/TypeScript linter)**
   - `Boshen.oxlint`

4. **Prettier - Code formatter** (optional but recommended)
   - `esbenp.prettier-vscode`

#### VS Code Settings

Create or update `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

### WebStorm / IntelliJ IDEA

- Built-in React and Tailwind CSS support
- No special configuration needed
- Enable "JavaScript language version" as ES2020+

## Development Best Practices

### File Organization

```
src/
├── components/     # React components
│   ├── Header.jsx
│   ├── Footer.jsx
│   └── ...
├── engine/         # Simulation logic
│   ├── Physics.ts
│   ├── NASAData.ts
│   └── ...
├── hooks/          # Custom React hooks
├── assets/         # Images, SVGs, data files
├── App.jsx         # Root component
├── main.jsx        # Entry point
└── index.css       # Global styles
```

### Component Structure

Use functional components with hooks:

```jsx
function MyComponent() {
  const [state, setState] = useState(null);
  
  return (
    <div className="p-4 rounded-lg">
      {/* Component content */}
    </div>
  );
}

export default MyComponent;
```

### Styling

Use Tailwind CSS classes for styling:

```jsx
<button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
  Click me
</button>
```

### Type Safety

Add TypeScript for better development experience:

```typescript
interface Props {
  count: number;
  onIncrement: (value: number) => void;
}

function Counter({ count, onIncrement }: Props) {
  return (
    <button onClick={() => onIncrement(count + 1)}>
      {count}
    </button>
  );
}
```

## Git Workflow

### Initialize Git (if not already done)

```bash
git init
git add .
git commit -m "Initial commit"
```

### Feature Branch Workflow

```bash
# Create a new branch for your feature
git checkout -b feature/mission-simulator

# Make your changes and commit
git add .
git commit -m "Add mission simulator feature"

# Push to remote
git push origin feature/mission-simulator

# Create a pull request on GitHub
```

### Pre-commit Checklist

Before committing code:

```bash
# Run linting
npm run lint

# Run type checking
npm run type-check

# Build to catch errors
npm run build

# Test locally
npm run dev
```

## Debugging

### Browser DevTools

1. Open Developer Tools: `F12` or `Cmd+Option+I`
2. **Console**: Check for error messages
3. **Network**: Monitor API calls and asset loading
4. **Performance**: Measure page load and interaction times
5. **Accessibility**: Use accessibility tree viewer

### VS Code Debugger

Add breakpoints in your code and use the VS Code debugger:

1. Set breakpoint (click line number)
2. Run with debugger: `npm run dev`
3. Debug tab in VS Code will show variables and call stack

### React DevTools

Install React DevTools browser extension to inspect React component tree:
- **Chrome**: React DevTools extension
- **Firefox**: React DevTools extension

## Performance Optimization

### Monitoring Bundle Size

```bash
npm run build:analyze
```

### Common Optimization Tips

1. **Code Splitting**
   - Use dynamic imports for large features
   - Vite automatically splits on build

2. **Lazy Loading**
   - Load components on demand
   - Use React.lazy() for route-based splitting

3. **Image Optimization**
   - Use SVG for icons
   - Compress PNG/JPEG with tools like TinyPNG
   - Use WebP format where supported

4. **CSS Optimization**
   - Tailwind purges unused styles
   - Use utility classes efficiently
   - Avoid inline styles

## Deployment Setup

### Vercel Deployment

1. **Connect Repository**
   ```bash
   vercel link
   ```

2. **Set Environment Variables**
   ```bash
   vercel env pull
   # Edit .env.local with your values
   vercel env add VITE_API_KEY
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

### GitHub Integration

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import the repository
4. Vercel auto-detects Vite configuration
5. Deploy automatically

## Troubleshooting

### npm install fails

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and lock file
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Port 5173 already in use

```bash
# Use a different port
npm run dev -- --port 3000

# Or find and kill the process
lsof -i :5173
kill -9 <PID>
```

### Build fails with "out of memory"

```bash
# Increase Node's memory limit
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

### Hot Module Replacement (HMR) not working

1. Restart dev server: `npm run dev`
2. Clear browser cache
3. Check if modifications are being saved to disk
4. Ensure no file watchers limit is hit (especially on Linux)

### TypeScript errors in editor but build succeeds

```bash
# Reinstall TypeScript
npm install --save-dev typescript@latest

# Restart editor
# (Close and reopen VS Code)
```

## Resources

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [NASA API Documentation](https://api.nasa.gov)

## Getting Help

1. **Check documentation** in README.md and this file
2. **Search online** for similar issues
3. **Check console errors** in browser DevTools
4. **Ask in community** (Discord, Stack Overflow, etc.)

---

Happy coding! 🚀
