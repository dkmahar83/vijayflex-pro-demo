// server/serve_frontend.js
// Frontend ki built files ko serve karta hai
// Ye PM2 se separately run hoga — port 5173 pe

const express = require('express');
const path = require('path');
const app = express();
const PORT = 5173;

// Serve static files from React build
const BUILD_PATH = process.env.FRONTEND_BUILD_PATH || path.join(__dirname, '..', 'client', 'dist');

app.use(express.static(BUILD_PATH));

// All routes → index.html (React Router ke liye)
app.get('*', (req, res) => {
  res.sendFile(path.join(BUILD_PATH, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`VijayFlex Pro Frontend running on http://localhost:${PORT}`);
});