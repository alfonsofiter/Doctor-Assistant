const express = require("express");
const { generateSoap, validateTranscript } = require("../controllers/soapController");

const router = express.Router();

router.post("/generate", generateSoap);
router.post("/validate", validateTranscript);

module.exports = router;
