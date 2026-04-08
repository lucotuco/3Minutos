const express = require('express');
const cors = require('cors');
const articleRoutes = require('./routes/articleRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  res.json({ ok: true, service: '3Minutos backend' });
});

app.use('/articles', articleRoutes);
app.use('/users', userRoutes);

module.exports = app;