const express = require('express');
const controller = require('../controllers/consultationController');

const router = express.Router();

router.post('/', controller.create);
router.get('/', controller.getAll);
router.get('/patients', controller.getPatients);
router.get('/by-patient/:patientId', controller.getByPatientId);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;

