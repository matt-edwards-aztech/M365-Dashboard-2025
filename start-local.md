# Local Development Server Options

## Option 1: Python (Most Common)

### Python 3:
```bash
python -m http.server 8080
```

### Python 2 (if still installed):
```bash
python -m SimpleHTTPServer 8080
```

Then open: http://localhost:8080

## Option 2: Node.js

### Using npx (no installation needed):
```bash
npx serve -s . -l 8080
```

### Using http-server:
```bash
npm install -g http-server
http-server -p 8080
```

Then open: http://localhost:8080

## Option 3: PHP
```bash
php -S localhost:8080
```

## Option 4: Live Server (VS Code Extension)
1. Install "Live Server" extension in VS Code
2. Right-click on index.html
3. Select "Open with Live Server"
4. Automatically opens in browser with hot reload

## Option 5: Browser-based (Limited)
Some browsers block local file access due to CORS. If you must:
1. Open Chrome with: `chrome --disable-web-security --user-data-dir="c:/temp/chrome"`
2. Open index.html directly

## Recommended Setup Steps:

1. **Start local server** (use Python option above)
2. **Update Azure AD redirect URI** to `http://localhost:8080`
3. **Test the application** at http://localhost:8080
4. **Check browser console** for any authentication or API errors

## Important Notes:
- Make sure to update your Azure AD App Registration redirect URI to match your local URL
- Use `http://localhost:8080` (not `127.0.0.1:8080`) for consistency
- The application needs to be served from a web server (not opened as a file) due to CORS restrictions