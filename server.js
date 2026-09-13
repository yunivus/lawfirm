const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Explicitly serve static assets
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use(express.static(__dirname, {
  extensions: ['html', 'htm'],
  index: ['index.html']
}));

// Root handler
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Navigation and clean URLs handler
app.get('*', (req, res, next) => {
  const ext = path.extname(req.path);
  
  // NEVER send HTML for static asset requests that were not found
  if (ext && ext !== '.html' && ext !== '.htm') {
    return res.status(404).type('text/plain').send('Asset not found');
  }

  // Attempt to resolve as clean HTML URL (e.g., /login -> /login.html)
  const cleanPath = req.path.replace(/\/$/, '');
  const candidateHtml = path.join(__dirname, `${cleanPath}.html`);

  if (fs.existsSync(candidateHtml)) {
    return res.sendFile(candidateHtml);
  }

  // Attempt candidate inside directory (e.g., /client -> /client/index.html or /client/dashboard.html)
  const candidateDirIndex = path.join(__dirname, cleanPath, 'index.html');
  if (fs.existsSync(candidateDirIndex)) {
    return res.sendFile(candidateDirIndex);
  }

  // Default SPA / navigation fallback to index.html for unknown routes
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Export app for serverless platforms (e.g. Vercel)
module.exports = app;

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LexCounsel app running on http://0.0.0.0:${PORT}`);
  });
}
