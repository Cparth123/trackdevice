const express = require('express');
const Device = require('../models/Device');
const { registerOrUpdateDevice, setStreaming, updatePassword } = require('../services/deviceService');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const devices = await Device.find({})
      .sort({ updatedAt: -1 })
      .limit(100);

    return res.json({
      count: devices.length,
      devices: devices.map((device) => device.toPublicJSON()),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const { deviceId, password } = req.body;
    if (!deviceId || !password) {
      return res.status(400).json({ error: 'deviceId and password are required' });
    }

    const device = await registerOrUpdateDevice(req.body, null);
    return res.status(201).json({
      success: true,
      device: device.toPublicJSON(),
    });
  } catch (error) {
    if (error.message === 'Invalid device password') {
      return res.status(401).json({ error: error.message });
    }
    return next(error);
  }
});

router.get('/:deviceId/status', async (req, res, next) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    return res.json(device.toPublicJSON());
  } catch (error) {
    return next(error);
  }
});

router.post('/:deviceId/stream', async (req, res, next) => {
  try {
    const { password, isStreaming } = req.body;
    const device = await Device.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const valid = await device.verifyPassword(password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    await setStreaming(req.params.deviceId, Boolean(isStreaming));
    const updated = await Device.findOne({ deviceId: req.params.deviceId });
    return res.json({
      success: true,
      device: updated.toPublicJSON(),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:deviceId/password', async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'oldPassword and newPassword are required' });
    }

    const device = await updatePassword(req.params.deviceId, oldPassword, newPassword);
    return res.json({
      success: true,
      device: device.toPublicJSON(),
    });
  } catch (error) {
    if (error.message === 'Device not found') {
      return res.status(404).json({ error: error.message });
    }

    if (error.message === 'Invalid device password') {
      return res.status(401).json({ error: error.message });
    }

    return next(error);
  }
});

router.post('/:deviceId/verify', async (req, res, next) => {
  try {
    const { password } = req.body;
    const device = await Device.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const valid = await device.verifyPassword(password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    return res.json({
      valid: true,
      device: device.toPublicJSON(),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
