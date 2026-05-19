const Device = require('../models/Device');

async function registerOrUpdateDevice(payload, socketId) {
  const { deviceId, password, deviceName, platform, appVersion } = payload;
  let device = await Device.findOne({ deviceId });

  if (!device) {
    const passwordHash = await Device.createPasswordHash(password);
    device = await Device.create({
      deviceId,
      passwordHash,
      deviceName,
      platform,
      appVersion,
      socketId,
      isOnline: true,
      isStreaming: false,
      lastSeen: new Date(),
    });
    return device;
  }

  const matches = await device.verifyPassword(password);
  if (!matches) {
    throw new Error('Invalid device password');
  }

  device.socketId = socketId;
  device.isOnline = true;
  device.lastSeen = new Date();
  device.deviceName = deviceName || device.deviceName;
  device.platform = platform || device.platform;
  device.appVersion = appVersion || device.appVersion;
  await device.save();
  return device;
}

async function markDeviceOffline(deviceId) {
  await Device.updateOne(
    { deviceId },
    { $set: { isOnline: false, isStreaming: false, socketId: null, lastSeen: new Date() } }
  );
}

async function touchDevice(deviceId) {
  await Device.updateOne({ deviceId }, { $set: { lastSeen: new Date() } });
}

async function setStreaming(deviceId, isStreaming) {
  await Device.updateOne(
    { deviceId },
    { $set: { isStreaming, lastSeen: new Date() } }
  );
}

async function updatePassword(deviceId, oldPassword, newPassword) {
  const device = await Device.findOne({ deviceId });
  if (!device) {
    throw new Error('Device not found');
  }

  const matches = await device.verifyPassword(oldPassword);
  if (!matches) {
    throw new Error('Invalid device password');
  }

  device.passwordHash = await Device.createPasswordHash(newPassword);
  device.lastSeen = new Date();
  await device.save();
  return device;
}

module.exports = {
  registerOrUpdateDevice,
  markDeviceOffline,
  touchDevice,
  setStreaming,
  updatePassword,
};
