const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    viewerSocketId: {
      type: String,
      required: true,
      index: true,
    },
    viewerLabel: {
      type: String,
      default: 'Browser Viewer',
    },
    viewerIp: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'active', 'ended', 'rejected'],
      default: 'pending',
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

SessionSchema.methods.markEnded = function markEnded() {
  this.status = 'ended';
  this.endedAt = new Date();
  if (this.startedAt) {
    this.durationSeconds = Math.floor((this.endedAt.getTime() - this.startedAt.getTime()) / 1000);
  }
  return this.save();
};

module.exports = mongoose.model('Session', SessionSchema);
