const express = require('express');
const Session = require('../models/Session');

const router = express.Router();

router.get('/:deviceId', async (req, res, next) => {
  try {
    const sessions = await Session.find({ deviceId: req.params.deviceId })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json({ sessions });
  } catch (error) {
    return next(error);
  }
});

router.get('/:deviceId/active', async (req, res, next) => {
  try {
    const sessions = await Session.find({
      deviceId: req.params.deviceId,
      status: { $in: ['pending', 'approved', 'active'] },
    }).sort({ createdAt: -1 });

    return res.json({ count: sessions.length, sessions });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
