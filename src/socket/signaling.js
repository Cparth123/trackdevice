const Device = require("../models/Device");
const Session = require("../models/Session");
const logger = require("../config/logger");
const {
  registerOrUpdateDevice,
  markDeviceOffline,
  touchDevice,
  setStreaming,
} = require("../services/deviceService");

const deviceSockets = new Map();
const viewerSockets = new Map();
const deviceViewers = new Map();

function getViewerSet(deviceId) {
  if (!deviceViewers.has(deviceId)) {
    deviceViewers.set(deviceId, new Set());
  }
  return deviceViewers.get(deviceId);
}

async function initializeSignaling(io) {
  io.on("connection", (socket) => {
    logger.info(`Socket connected ${socket.id}`);

    socket.on("device:register", async (payload, ack) => {
      try {
        const { deviceId, password } = payload || {};
        if (!deviceId || !password) {
          throw new Error("deviceId and password are required");
        }

        const device = await registerOrUpdateDevice(payload, socket.id);
        deviceSockets.set(socket.id, deviceId);
        socket.join(`device:${deviceId}`);

        ack?.({ ok: true, device: device.toPublicJSON() });
        socket.emit("device:registered", { device: device.toPublicJSON() });
        console.log("DEVICE REGISTER PAYLOAD:", payload);
      } catch (error) {
        logger.error(`device:register failed ${error.message}`);
        ack?.({ ok: false, error: error.message });
        socket.emit("device:error", { error: error.message });
      }
    });

    socket.on("device:heartbeat", async ({ deviceId }, ack) => {
      try {
        await touchDevice(deviceId);
        ack?.({ ok: true, timestamp: Date.now() });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });

    socket.on("stream:started", async ({ deviceId }, ack) => {
      try {
        await setStreaming(deviceId, true);
        io.to(`viewers:${deviceId}`).emit("stream:available", { deviceId });
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });

    socket.on("stream:stopped", async ({ deviceId }, ack) => {
      try {
        await setStreaming(deviceId, false);
        io.to(`viewers:${deviceId}`).emit("stream:ended", {
          deviceId,
          reason: "Device stopped streaming",
        });
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });

    socket.on(
      "viewer:authenticate",
      async ({ deviceId, password, viewerLabel }, ack) => {
        try {
          const device = await Device.findOne({ deviceId });
          if (!device) {
            throw new Error("Device not found");
          }

          const valid = await device.verifyPassword(password);
          if (!valid) {
            throw new Error("Invalid password");
          }

          if (!device.isOnline) {
            throw new Error("Device is offline");
          }

          const viewers = getViewerSet(deviceId);
          const maxViewers = Number(process.env.MAX_VIEWERS_PER_DEVICE || 5);
          if (viewers.size >= maxViewers) {
            throw new Error("Maximum viewers reached");
          }

          viewers.add(socket.id);
          viewerSockets.set(socket.id, { deviceId });
          socket.join(`viewers:${deviceId}`);

          await Session.create({
            deviceId,
            viewerSocketId: socket.id,
            viewerLabel: viewerLabel || "Browser Viewer",
            viewerIp: socket.handshake.address,
            status: device.isStreaming ? "approved" : "pending",
            startedAt: device.isStreaming ? new Date() : null,
          });

          ack?.({
            ok: true,
            device: device.toPublicJSON(),
            viewerSocketId: socket.id,
          });

          io.to(`device:${deviceId}`).emit("viewer:request-stream", {
            viewerSocketId: socket.id,
            viewerLabel: viewerLabel || "Browser Viewer",
            viewerCount: viewers.size,
          });

          console.log("VIEWER AUTH:", deviceId);

          const devices = await Device.find({});
          console.log(
            "DATABASE DEVICES:",
            devices.map((d) => ({
              deviceId: d.deviceId,
              online: d.isOnline,
            })),
          );
        } catch (error) {
          ack?.({ ok: false, error: error.message });
        }
      },
    );

    socket.on("viewer:approved", async ({ deviceId, viewerSocketId }, ack) => {
      try {
        await Session.updateOne(
          {
            deviceId,
            viewerSocketId,
            status: { $in: ["pending", "approved"] },
          },
          { $set: { status: "approved", startedAt: new Date() } },
        );

        io.to(viewerSocketId).emit("viewer:approved", { deviceId });
        io.to(`device:${deviceId}`).emit("viewer:ready", { viewerSocketId });
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });

    socket.on("viewer:rejected", async ({ deviceId, viewerSocketId }, ack) => {
      try {
        await Session.updateOne(
          {
            deviceId,
            viewerSocketId,
            status: { $in: ["pending", "approved"] },
          },
          { $set: { status: "rejected", endedAt: new Date() } },
        );
        io.to(viewerSocketId).emit("viewer:rejected", { deviceId });
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });

    socket.on("webrtc:offer", ({ deviceId, viewerSocketId, offer }) => {
      io.to(viewerSocketId).emit("webrtc:offer", { deviceId, offer });
    });

    socket.on("webrtc:answer", async ({ deviceId, answer }, ack) => {
      try {
        io.to(`device:${deviceId}`).emit("webrtc:answer", {
          viewerSocketId: socket.id,
          answer,
        });

        await Session.updateOne(
          { deviceId, viewerSocketId: socket.id, status: "approved" },
          { $set: { status: "active" } },
        );
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });

    socket.on(
      "webrtc:ice-candidate",
      ({ deviceId, viewerSocketId, candidate }) => {
        if (deviceSockets.has(socket.id)) {
          io.to(viewerSocketId).emit("webrtc:ice-candidate", { candidate });
          return;
        }

        io.to(`device:${deviceId}`).emit("webrtc:ice-candidate", {
          viewerSocketId: socket.id,
          candidate,
        });
      },
    );

    socket.on("viewer:disconnect-request", ({ deviceId }, ack) => {
      io.to(`device:${deviceId}`).emit("viewer:disconnect-request", {
        viewerSocketId: socket.id,
      });
      ack?.({ ok: true });
    });

    socket.on("disconnect", async () => {
      const deviceId = deviceSockets.get(socket.id);
      if (deviceId) {
        deviceSockets.delete(socket.id);
        await markDeviceOffline(deviceId);
        io.to(`viewers:${deviceId}`).emit("stream:ended", {
          deviceId,
          reason: "Device disconnected",
        });
        logger.info(`Device disconnected ${deviceId}`);
      }

      const viewerEntry = viewerSockets.get(socket.id);
      if (viewerEntry) {
        viewerSockets.delete(socket.id);
        const viewers = deviceViewers.get(viewerEntry.deviceId);
        viewers?.delete(socket.id);
        if (viewers && viewers.size === 0) {
          deviceViewers.delete(viewerEntry.deviceId);
        }

        await Session.updateOne(
          {
            viewerSocketId: socket.id,
            status: { $in: ["pending", "approved", "active"] },
          },
          { $set: { status: "ended", endedAt: new Date() } },
        );

        io.to(`device:${viewerEntry.deviceId}`).emit("viewer:disconnected", {
          viewerSocketId: socket.id,
          viewerCount: viewers?.size || 0,
        });
      }
    });
  });
}

module.exports = { initializeSignaling };
