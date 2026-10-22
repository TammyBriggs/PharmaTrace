const express = require('express');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./routes/authRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(','),
  credentials: true,
}));
app.use(express.json());

// Mount the authentication routes
app.use('/api/auth', authRoutes); 
// Mount the report routes
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'active', message: 'PharmaTrace API is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
