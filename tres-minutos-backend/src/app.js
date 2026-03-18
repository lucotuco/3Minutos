const express = require('express');
const articleRoutes = require('./routes/articleRoutes');

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('API de 3 Minutos funcionando');
});

app.use('/articles', articleRoutes);

module.exports = app;