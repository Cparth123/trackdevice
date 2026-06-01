const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const DeviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    deviceName: {
      type: String,
      default: 'Android Device',
      maxlength: 100,
    },
    platform: {
      type: String,
      enum: ['android', 'ios', 'desktop', 'unknown'],
      default: 'android',
    },
    appVersion: {
      type: String,
      default: 'unknown',
    },
    socketId: {
      type: String,
      default: null,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    isStreaming: {
      type: Boolean,
      default: false,
    },
    deviceData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    totalSessions: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

DeviceSchema.methods.verifyPassword = function verifyPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

DeviceSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    deviceId: this.deviceId,
    deviceName: this.deviceName,
    platform: this.platform,
    appVersion: this.appVersion,
    isOnline: this.isOnline,
    isStreaming: this.isStreaming,
    deviceData: this.deviceData || {},
    lastSeen: this.lastSeen,
    totalSessions: this.totalSessions,
  };
};

DeviceSchema.statics.createPasswordHash = function createPasswordHash(password) {
  return bcrypt.hash(password, 10);
};

module.exports = mongoose.model('Device', DeviceSchema);
