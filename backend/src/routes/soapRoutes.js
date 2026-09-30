const express = require('express');
const { generateSoap } = require('../controllers/soapController');

const router = express.Router();

router.post('/generate', generateSoap);

module.exports = router;
