const express = require("express");
const multer = require("multer");
const { transcribe } = require("../controllers/transcribeController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post(
  "/",
  (req, res, next) => {
    upload.single("audio")(req, res, (error) => {
      if (!error) return next();

      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          error:
            "Rekaman terlalu besar (maks 25 MB). Coba rekam lebih singkat.",
        });
      }
      return res.status(400).json({ error: "Gagal membaca file audio." });
    });
  },
  transcribe,
);

module.exports = router;
