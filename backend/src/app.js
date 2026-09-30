const express = require('express');
const cors = require('cors');
const soapRoutes = require('./routes/soapRoutes');
const consultationRoutes = require('./routes/consultationRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Doctor Assistant backend berjalan',
  });
});

app.use('/api/soap', soapRoutes);
app.use('/api/consultations', consultationRoutes);

module.exports = app;
