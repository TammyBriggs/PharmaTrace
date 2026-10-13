const express = require('express');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./routes/authRoutes');
const app = express();

app.use(cors());
app.use(express.json());

// Mount the authentication routes
app.use('/api/auth', authRoutes); 

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'active', message: 'PharmaTrace API is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
