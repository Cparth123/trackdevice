// const Device = require("../models/Device");
// const Session = require("../models/Session");
// const logger = require("../config/logger");
// const {
//   registerOrUpdateDevice,
//   markDeviceOffline,
//   touchDevice,
//   setStreaming,
// } = require("../services/deviceService");

// const deviceSockets = new Map();
// const viewerSockets = new Map();
// const deviceViewers = new Map();

// function getViewerSet(deviceId) {
//   if (!deviceViewers.has(deviceId)) {
//     deviceViewers.set(deviceId, new Set());
//   }
//   return deviceViewers.get(deviceId);
// }

// async function initializeSignaling(io) {
//   io.on("connection", (socket) => {
//     logger.info(`Socket connected ${socket.id}`);

//     socket.on("device:register", async (payload, ack) => {
//       try {
//         const { deviceId, password } = payload || {};
//         if (!deviceId || !password) {
//           throw new Error("deviceId and password are required");
//         }

//         const device = await registerOrUpdateDevice(payload, socket.id);
//         deviceSockets.set(socket.id, deviceId);
//         socket.join(`device:${deviceId}`);

//         ack?.({ ok: true, device: device.toPublicJSON() });
//         socket.emit("device:registered", { device: device.toPublicJSON() });
//         console.log("DEVICE REGISTER PAYLOAD:", payload);
//       } catch (error) {
//         logger.error(`device:register failed ${error.message}`);
//         ack?.({ ok: false, error: error.message });
//         socket.emit("device:error", { error: error.message });
//       }
//     });

//     socket.on("device:heartbeat", async ({ deviceId }, ack) => {
//       try {
//         await touchDevice(deviceId);
//         ack?.({ ok: true, timestamp: Date.now() });
//       } catch (error) {
//         ack?.({ ok: false, error: error.message });
//       }
//     });

//     socket.on("device:data", async ({ deviceId, data }, ack) => {
//       try {
//         if (!deviceSockets.has(socket.id)) {
//           throw new Error("Only registered devices may send device data");
//         }

//         const device = await Device.findOne({ deviceId });
//         if (!device) {
//           throw new Error("Device not found");
//         }

//         device.deviceData = data || {};
//         device.lastSeen = new Date();
//         await device.save();

//         io.to(`viewers:${deviceId}`).emit("device:data", {
//           deviceId,
//           data: device.deviceData,
//         });

//         ack?.({ ok: true });
//       } catch (error) {
//         ack?.({ ok: false, error: error.message });
//       }
//     });

//     socket.on("stream:started", async ({ deviceId }, ack) => {
//       try {
//         await setStreaming(deviceId, true);
//         io.to(`viewers:${deviceId}`).emit("stream:available", { deviceId });
//         ack?.({ ok: true });
//       } catch (error) {
//         ack?.({ ok: false, error: error.message });
//       }
//     });

//     socket.on("stream:stopped", async ({ deviceId }, ack) => {
//       try {
//         await setStreaming(deviceId, false);
//         io.to(`viewers:${deviceId}`).emit("stream:ended", {
//           deviceId,
//           reason: "Device stopped streaming",
//         });
//         ack?.({ ok: true });
//       } catch (error) {
//         ack?.({ ok: false, error: error.message });
//       }
//     });

//     socket.on(
//       "viewer:authenticate",
//       async ({ deviceId, password, viewerLabel }, ack) => {
//         try {
//           const device = await Device.findOne({ deviceId });
//           if (!device) {
//             throw new Error("Device not found");
//           }

//           const valid = await device.verifyPassword(password);
//           if (!valid) {
//             throw new Error("Invalid password");
//           }

//           // if (!device.isOnline) {
//           //   throw new Error("Device is offline");
//           // }

//           const viewers = getViewerSet(deviceId);
//           const maxViewers = Number(process.env.MAX_VIEWERS_PER_DEVICE || 5);
//           if (viewers.size >= maxViewers) {
//             throw new Error("Maximum viewers reached");
//           }

//           viewers.add(socket.id);
//           viewerSockets.set(socket.id, { deviceId });
//           socket.join(`viewers:${deviceId}`);

//           await Session.create({
//             deviceId,
//             viewerSocketId: socket.id,
//             viewerLabel: viewerLabel || "Browser Viewer",
//             viewerIp: socket.handshake.address,
//             status: device.isStreaming ? "approved" : "pending",
//             startedAt: device.isStreaming ? new Date() : null,
//           });

//           ack?.({
//             ok: true,
//             device: device.toPublicJSON(),
//             viewerSocketId: socket.id,
//           });

//           io.to(`device:${deviceId}`).emit("viewer:request-stream", {
//             viewerSocketId: socket.id,
//             viewerLabel: viewerLabel || "Browser Viewer",
//             viewerCount: viewers.size,
//           });

//           console.log("VIEWER AUTH:", deviceId);

//           const devices = await Device.find({});
//           console.log(
//             "DATABASE DEVICES:",
//             devices.map((d) => ({
//               deviceId: d.deviceId,
//               online: d.isOnline,
//             })),
//           );
//         } catch (error) {
//           ack?.({ ok: false, error: error.message });
//         }
//       },
//     );

//     socket.on("viewer:approved", async ({ deviceId, viewerSocketId }, ack) => {
//       try {
//         await Session.updateOne(
//           {
//             deviceId,
//             viewerSocketId,
//             status: { $in: ["pending", "approved"] },
//           },
//           { $set: { status: "approved", startedAt: new Date() } },
//         );

//         io.to(viewerSocketId).emit("viewer:approved", { deviceId });
//         io.to(`device:${deviceId}`).emit("viewer:ready", { viewerSocketId });
//         ack?.({ ok: true });
//       } catch (error) {
//         ack?.({ ok: false, error: error.message });
//       }
//     });

//     socket.on("viewer:rejected", async ({ deviceId, viewerSocketId }, ack) => {
//       try {
//         await Session.updateOne(
//           {
//             deviceId,
//             viewerSocketId,
//             status: { $in: ["pending", "approved"] },
//           },
//           { $set: { status: "rejected", endedAt: new Date() } },
//         );
//         io.to(viewerSocketId).emit("viewer:rejected", { deviceId });
//         ack?.({ ok: true });
//       } catch (error) {
//         ack?.({ ok: false, error: error.message });
//       }
//     });

//     socket.on("webrtc:offer", ({ deviceId, viewerSocketId, offer }) => {
//       io.to(viewerSocketId).emit("webrtc:offer", { deviceId, offer });
//     });

//     socket.on("webrtc:answer", async ({ deviceId, answer }, ack) => {
//       try {
//         io.to(`device:${deviceId}`).emit("webrtc:answer", {
//           viewerSocketId: socket.id,
//           answer,
//         });

//         await Session.updateOne(
//           { deviceId, viewerSocketId: socket.id, status: "approved" },
//           { $set: { status: "active" } },
//         );
//         ack?.({ ok: true });
//       } catch (error) {
//         ack?.({ ok: false, error: error.message });
//       }
//     });

//     socket.on(
//       "webrtc:ice-candidate",
//       ({ deviceId, viewerSocketId, candidate }) => {
//         if (deviceSockets.has(socket.id)) {
//           io.to(viewerSocketId).emit("webrtc:ice-candidate", { candidate });
//           return;
//         }

//         io.to(`device:${deviceId}`).emit("webrtc:ice-candidate", {
//           viewerSocketId: socket.id,
//           candidate,
//         });
//       },
//     );

//     socket.on("viewer:disconnect-request", ({ deviceId }, ack) => {
//       io.to(`device:${deviceId}`).emit("viewer:disconnect-request", {
//         viewerSocketId: socket.id,
//       });
//       ack?.({ ok: true });
//     });

//     socket.on("disconnect", async () => {
//       const deviceId = deviceSockets.get(socket.id);
//       if (deviceId) {
//         deviceSockets.delete(socket.id);
//         await markDeviceOffline(deviceId);
//         io.to(`viewers:${deviceId}`).emit("stream:ended", {
//           deviceId,
//           reason: "Device disconnected",
//         });
//         logger.info(`Device disconnected ${deviceId}`);
//       }

//       const viewerEntry = viewerSockets.get(socket.id);
//       if (viewerEntry) {
//         viewerSockets.delete(socket.id);
//         const viewers = deviceViewers.get(viewerEntry.deviceId);
//         viewers?.delete(socket.id);
//         if (viewers && viewers.size === 0) {
//           deviceViewers.delete(viewerEntry.deviceId);
//         }

//         await Session.updateOne(
//           {
//             viewerSocketId: socket.id,
//             status: { $in: ["pending", "approved", "active"] },
//           },
//           { $set: { status: "ended", endedAt: new Date() } },
//         );

//         io.to(`device:${viewerEntry.deviceId}`).emit("viewer:disconnected", {
//           viewerSocketId: socket.id,
//           viewerCount: viewers?.size || 0,
//         });
//       }
//     });
//   });
// }

// module.exports = { initializeSignaling };

// const Device = require("../models/Device");
// const Session = require("../models/Session");
// const logger = require("../config/logger");
// const {
//   registerOrUpdateDevice,
//   markDeviceOffline,
//   touchDevice,
//   setStreaming,
// } = require("../services/deviceService");

// const deviceSockets = new Map();
// const viewerSockets = new Map();
// const deviceViewers = new Map();

// function getViewerSet(deviceId) {
//   if (!deviceViewers.has(deviceId)) {
//     deviceViewers.set(deviceId, new Set());
//   }
//   return deviceViewers.get(deviceId);
// }

// async function initializeSignaling(io) {
//   io.on("connection", (socket) => {
//     logger.info(`Socket connected ${socket.id}`);

//     socket.on("device:register", async (payload, ack) => {
//       try {
//         console.log("DEVICE REGISTER PAYLOAD:", payload);

//         // FIX: Ensure deviceId and password are extracted correctly
//         const { deviceId, password, deviceName, platform, appVersion } = payload || {};

//         if (!deviceId || !password) {
//           throw new Error("deviceId and password are required");
//         }

//         // Register or update device with ALL fields
//         const device = await registerOrUpdateDevice({
//           deviceId,
//           password,
//           deviceName: deviceName || "Unknown Device",
//           platform: platform || "android",
//           appVersion: appVersion || "1.0"
//         }, socket.id);

//         deviceSockets.set(socket.id, deviceId);
//         socket.join(`device:${deviceId}`);

//         ack?.({ ok: true, device: device.toPublicJSON() });
//         socket.emit("device:registered", { device: device.toPublicJSON() });
//         console.log(`Device registered successfully: ${deviceId}`);
//       } catch (error) {
//         logger.error(`device:register failed ${error.message}`);
//         ack?.({ ok: false, error: error.message });
//         socket.emit("device:error", { error: error.message });
//       }
//     });

//     socket.on("device:heartbeat", async ({ deviceId }, ack) => {
//       try {
//         if (!deviceId) {
//           throw new Error("deviceId is required");
//         }
//         await touchDevice(deviceId);
//         ack?.({ ok: true, timestamp: Date.now() });
//       } catch (error) {
//         ack?.({ ok: false, error: error.message });
//       }
//     });

//     socket.on("device:data", async ({ deviceId, data }, ack) => {
//       try {
//         const registeredDeviceId = deviceSockets.get(socket.id);
//         if (!registeredDeviceId || registeredDeviceId !== deviceId) {
//           throw new Error("Only registered devices may send device data");
//         }

//         const device = await Device.findOne({ deviceId });
//         if (!device) {
//           throw new Error("Device not found");
//         }

//         device.deviceData = data || {};
//         device.lastSeen = new Date();
//         await device.save();

//         // Notify all viewers of this device
//         io.to(`viewers:${deviceId}`).emit("device:data", {
//           deviceId,
//           data: device.deviceData,
//         });

//         ack?.({ ok: true });
//       } catch (error) {
//         ack?.({ ok: false, error: error.message });
//       }
//     });

//     socket.on("stream:started", async ({ deviceId }, ack) => {
//       try {
//         if (!deviceId) {
//           throw new Error("deviceId is required");
//         }
//         await setStreaming(deviceId, true);
//         io.to(`viewers:${deviceId}`).emit("stream:available", { deviceId });
//         ack?.({ ok: true });
//         console.log(`Stream started for device: ${deviceId}`);
//       } catch (error) {
//         ack?.({ ok: false, error: error.message });
//       }
//     });

//     socket.on("stream:stopped", async ({ deviceId }, ack) => {
//       try {
//         if (!deviceId) {
//           throw new Error("deviceId is required");
//         }
//         await setStreaming(deviceId, false);
//         io.to(`viewers:${deviceId}`).emit("stream:ended", {
//           deviceId,
//           reason: "Device stopped streaming",
//         });
//         ack?.({ ok: true });
//         console.log(`Stream stopped for device: ${deviceId}`);
//       } catch (error) {
//         ack?.({ ok: false, error: error.message });
//       }
//     });

//     socket.on(
//       "viewer:authenticate",
//       async ({ deviceId, password, viewerLabel }, ack) => {
//         try {
//           console.log(`Viewer authentication attempt for device: ${deviceId}`);

//           const device = await Device.findOne({ deviceId });
//           if (!device) {
//             throw new Error("Device not found");
//           }

//           const valid = await device.verifyPassword(password);
//           if (!valid) {
//             throw new Error("Invalid password");
//           }

//           // Check if device is online and streaming
//           if (!device.isOnline) {
//             throw new Error("Device is offline");
//           }

//           if (!device.isStreaming) {
//             throw new Error("Device is not streaming yet. Please ask the device owner to start streaming.");
//           }

//           const viewers = getViewerSet(deviceId);
//           const maxViewers = Number(process.env.MAX_VIEWERS_PER_DEVICE || 10);
//           if (viewers.size >= maxViewers) {
//             throw new Error("Maximum viewers reached");
//           }

//           viewers.add(socket.id);
//           viewerSockets.set(socket.id, { deviceId });
//           socket.join(`viewers:${deviceId}`);

//           await Session.create({
//             deviceId,
//             viewerSocketId: socket.id,
//             viewerLabel: viewerLabel || "Browser Viewer",
//             viewerIp: socket.handshake.address,
//             status: "pending",
//             startedAt: new Date(),
//           });

//           ack?.({
//             ok: true,
//             device: device.toPublicJSON(),
//             viewerSocketId: socket.id,
//           });

//           // Request stream from device
//           io.to(`device:${deviceId}`).emit("viewer:request-stream", {
//             viewerSocketId: socket.id,
//             viewerLabel: viewerLabel || "Browser Viewer",
//             viewerCount: viewers.size,
//           });

//           console.log(`Viewer authenticated for device ${deviceId}, viewers: ${viewers.size}`);
//         } catch (error) {
//           console.error(`Viewer authentication failed: ${error.message}`);
//           ack?.({ ok: false, error: error.message });
//         }
//       },
//     );

//     socket.on("viewer:approved", async ({ deviceId, viewerSocketId }, ack) => {
//       try {
//         await Session.updateOne(
//           {
//             deviceId,
//             viewerSocketId,
//             status: "pending",
//           },
//           { $set: { status: "approved" } }
//         );

//         io.to(viewerSocketId).emit("viewer:approved", { deviceId });
//         ack?.({ ok: true });
//       } catch (error) {
//         ack?.({ ok: false, error: error.message });
//       }
//     });

//     socket.on("viewer:rejected", async ({ deviceId, viewerSocketId }, ack) => {
//       try {
//         await Session.updateOne(
//           {
//             deviceId,
//             viewerSocketId,
//             status: "pending",
//           },
//           { $set: { status: "rejected", endedAt: new Date() } }
//         );
//         io.to(viewerSocketId).emit("viewer:rejected", { deviceId });
//         ack?.({ ok: true });
//       } catch (error) {
//         ack?.({ ok: false, error: error.message });
//       }
//     });

//     socket.on("webrtc:offer", ({ deviceId, viewerSocketId, offer }) => {
//       io.to(viewerSocketId).emit("webrtc:offer", { deviceId, offer });
//       console.log(`WebRTC offer sent to viewer: ${viewerSocketId}`);
//     });

//     socket.on("webrtc:answer", async ({ deviceId, answer }, ack) => {
//       try {
//         io.to(`device:${deviceId}`).emit("webrtc:answer", {
//           viewerSocketId: socket.id,
//           answer,
//         });

//         await Session.updateOne(
//           { deviceId, viewerSocketId: socket.id, status: "approved" },
//           { $set: { status: "active" } }
//         );
//         ack?.({ ok: true });
//       } catch (error) {
//         ack?.({ ok: false, error: error.message });
//       }
//     });

//     socket.on(
//       "webrtc:ice-candidate",
//       ({ deviceId, viewerSocketId, candidate }) => {
//         if (deviceSockets.has(socket.id)) {
//           io.to(viewerSocketId).emit("webrtc:ice-candidate", { candidate });
//           return;
//         }

//         io.to(`device:${deviceId}`).emit("webrtc:ice-candidate", {
//           viewerSocketId: socket.id,
//           candidate,
//         });
//       },
//     );

//     socket.on("viewer:disconnect-request", ({ deviceId }, ack) => {
//       io.to(`device:${deviceId}`).emit("viewer:disconnect-request", {
//         viewerSocketId: socket.id,
//       });
//       ack?.({ ok: true });
//     });

//     socket.on("disconnect", async () => {
//       const deviceId = deviceSockets.get(socket.id);
//       if (deviceId) {
//         deviceSockets.delete(socket.id);
//         await markDeviceOffline(deviceId);
//         io.to(`viewers:${deviceId}`).emit("stream:ended", {
//           deviceId,
//           reason: "Device disconnected",
//         });
//         logger.info(`Device disconnected ${deviceId}`);
//       }

//       const viewerEntry = viewerSockets.get(socket.id);
//       if (viewerEntry) {
//         viewerSockets.delete(socket.id);
//         const viewers = deviceViewers.get(viewerEntry.deviceId);
//         viewers?.delete(socket.id);
//         if (viewers && viewers.size === 0) {
//           deviceViewers.delete(viewerEntry.deviceId);
//         }

//         await Session.updateOne(
//           {
//             viewerSocketId: socket.id,
//             status: { $in: ["pending", "approved", "active"] },
//           },
//           { $set: { status: "ended", endedAt: new Date() } }
//         );

//         io.to(`device:${viewerEntry.deviceId}`).emit("viewer:disconnected", {
//           viewerSocketId: socket.id,
//           viewerCount: viewers?.size || 0,
//         });
//       }
//     });
//   });
// }

// module.exports = { initializeSignaling };



// const Device = require("../models/Device");
// const Session = require("../models/Session");
// const logger = require("../config/logger");
// const {
//   registerOrUpdateDevice,
//   markDeviceOffline,
//   touchDevice,
//   setStreaming,
// } = require("../services/deviceService");

// const deviceSockets = new Map();
// const viewerSockets = new Map();
// const deviceViewers = new Map();

// function getViewerSet(deviceId) {
//   if (!deviceViewers.has(deviceId)) {
//     deviceViewers.set(deviceId, new Set());
//   }
//   return deviceViewers.get(deviceId);
// }

// async function initializeSignaling(io) {
//   io.on("connection", (socket) => {
//     logger.info(`Socket connected ${socket.id}`);

//     // Device registration
//     socket.on("device:register", async (payload, ack) => {
//       try {
//         logger.info(`Device registration payload: ${JSON.stringify(payload)}`);

//         const { deviceId, password, deviceName, platform, appVersion } = payload || {};

//         if (!deviceId || !password) {
//           throw new Error("deviceId and password are required");
//         }

//         // Check if device exists
//         const existingDevice = await Device.findOne({ deviceId });
//         logger.info(`Device exists: ${!!existingDevice}`);

//         const device = await registerOrUpdateDevice({
//           deviceId,
//           password,
//           deviceName: deviceName || "Unknown Device",
//           platform: platform || "android",
//           appVersion: appVersion || "1.0"
//         }, socket.id);

//         deviceSockets.set(socket.id, deviceId);
//         socket.join(`device:${deviceId}`);

//         logger.info(`Device registered successfully: ${deviceId}`);

//         if (ack) {
//           ack({ ok: true, device: device.toPublicJSON() });
//         }
//         socket.emit("device:registered", { device: device.toPublicJSON() });
//       } catch (error) {
//         logger.error(`device:register failed: ${error.message}`);
//         if (ack) {
//           ack({ ok: false, error: error.message });
//         }
//         socket.emit("device:error", { error: error.message });
//       }
//     });

//     // Device heartbeat
//     socket.on("device:heartbeat", async ({ deviceId }, ack) => {
//       try {
//         if (!deviceId) {
//           throw new Error("deviceId is required");
//         }
//         await touchDevice(deviceId);
//         if (ack) ack({ ok: true, timestamp: Date.now() });
//       } catch (error) {
//         logger.error(`Heartbeat error: ${error.message}`);
//         if (ack) ack({ ok: false, error: error.message });
//       }
//     });

//     // Device data
//     socket.on("device:data", async ({ deviceId, data }, ack) => {
//       try {
//         const registeredDeviceId = deviceSockets.get(socket.id);
//         if (!registeredDeviceId || registeredDeviceId !== deviceId) {
//           throw new Error("Only registered devices may send device data");
//         }

//         const device = await Device.findOne({ deviceId });
//         if (!device) {
//           throw new Error("Device not found");
//         }

//         device.deviceData = data || {};
//         device.lastSeen = new Date();
//         await device.save();

//         io.to(`viewers:${deviceId}`).emit("device:data", {
//           deviceId,
//           data: device.deviceData,
//         });

//         if (ack) ack({ ok: true });
//       } catch (error) {
//         logger.error(`Device data error: ${error.message}`);
//         if (ack) ack({ ok: false, error: error.message });
//       }
//     });

//     // Stream started
//     socket.on("stream:started", async ({ deviceId }, ack) => {
//       try {
//         if (!deviceId) throw new Error("deviceId is required");
//         await setStreaming(deviceId, true);
//         io.to(`viewers:${deviceId}`).emit("stream:available", { deviceId });
//         logger.info(`Stream started for device: ${deviceId}`);
//         if (ack) ack({ ok: true });
//       } catch (error) {
//         logger.error(`Stream started error: ${error.message}`);
//         if (ack) ack({ ok: false, error: error.message });
//       }
//     });

//     // Stream stopped
//     socket.on("stream:stopped", async ({ deviceId }, ack) => {
//       try {
//         if (!deviceId) throw new Error("deviceId is required");
//         await setStreaming(deviceId, false);
//         io.to(`viewers:${deviceId}`).emit("stream:ended", {
//           deviceId,
//           reason: "Device stopped streaming",
//         });
//         logger.info(`Stream stopped for device: ${deviceId}`);
//         if (ack) ack({ ok: true });
//       } catch (error) {
//         logger.error(`Stream stopped error: ${error.message}`);
//         if (ack) ack({ ok: false, error: error.message });
//       }
//     });

//     // Viewer authentication
//     socket.on("viewer:authenticate", async ({ deviceId, password, viewerLabel }, ack) => {
//       try {
//         logger.info(`Viewer authentication attempt for device: ${deviceId}`);

//         const device = await Device.findOne({ deviceId });
//         if (!device) {
//           throw new Error("Device not found");
//         }

//         const valid = await device.verifyPassword(password);
//         if (!valid) {
//           throw new Error("Invalid password");
//         }

//         if (!device.isOnline) {
//           throw new Error("Device is offline");
//         }

//         if (!device.isStreaming) {
//           throw new Error("Device is not streaming yet. Please ask the device owner to start streaming.");
//         }

//         const viewers = getViewerSet(deviceId);
//         const maxViewers = Number(process.env.MAX_VIEWERS_PER_DEVICE || 5);
//         if (viewers.size >= maxViewers) {
//           throw new Error("Maximum viewers reached");
//         }

//         viewers.add(socket.id);
//         viewerSockets.set(socket.id, { deviceId });
//         socket.join(`viewers:${deviceId}`);

//         await Session.create({
//           deviceId,
//           viewerSocketId: socket.id,
//           viewerLabel: viewerLabel || "Browser Viewer",
//           viewerIp: socket.handshake.address,
//           status: "pending",
//           startedAt: new Date(),
//         });

//         logger.info(`Viewer authenticated for device ${deviceId}, viewers: ${viewers.size}`);

//         if (ack) {
//           ack({
//             ok: true,
//             device: device.toPublicJSON(),
//             viewerSocketId: socket.id,
//           });
//         }

//         io.to(`device:${deviceId}`).emit("viewer:request-stream", {
//           viewerSocketId: socket.id,
//           viewerLabel: viewerLabel || "Browser Viewer",
//           viewerCount: viewers.size,
//         });
//       } catch (error) {
//         logger.error(`Viewer authentication failed: ${error.message}`);
//         if (ack) {
//           ack({ ok: false, error: error.message });
//         }
//       }
//     });

//     // Viewer approved
//     socket.on("viewer:approved", async ({ deviceId, viewerSocketId }, ack) => {
//       try {
//         await Session.updateOne(
//           { deviceId, viewerSocketId, status: "pending" },
//           { $set: { status: "approved" } }
//         );
//         io.to(viewerSocketId).emit("viewer:approved", { deviceId });
//         if (ack) ack({ ok: true });
//       } catch (error) {
//         logger.error(`Viewer approved error: ${error.message}`);
//         if (ack) ack({ ok: false, error: error.message });
//       }
//     });

//     // Viewer rejected
//     socket.on("viewer:rejected", async ({ deviceId, viewerSocketId }, ack) => {
//       try {
//         await Session.updateOne(
//           { deviceId, viewerSocketId, status: "pending" },
//           { $set: { status: "rejected", endedAt: new Date() } }
//         );
//         io.to(viewerSocketId).emit("viewer:rejected", { deviceId });
//         if (ack) ack({ ok: true });
//       } catch (error) {
//         logger.error(`Viewer rejected error: ${error.message}`);
//         if (ack) ack({ ok: false, error: error.message });
//       }
//     });

//     // WebRTC signaling
//     socket.on("webrtc:offer", ({ deviceId, viewerSocketId, offer }) => {
//       io.to(viewerSocketId).emit("webrtc:offer", { deviceId, offer });
//       logger.info(`WebRTC offer sent to viewer: ${viewerSocketId}`);
//     });

//     socket.on("webrtc:answer", async ({ deviceId, answer }, ack) => {
//       try {
//         io.to(`device:${deviceId}`).emit("webrtc:answer", {
//           viewerSocketId: socket.id,
//           answer,
//         });
//         await Session.updateOne(
//           { deviceId, viewerSocketId: socket.id, status: "approved" },
//           { $set: { status: "active" } }
//         );
//         if (ack) ack({ ok: true });
//       } catch (error) {
//         logger.error(`WebRTC answer error: ${error.message}`);
//         if (ack) ack({ ok: false, error: error.message });
//       }
//     });

//     socket.on("webrtc:ice-candidate", ({ deviceId, viewerSocketId, candidate }) => {
//       if (deviceSockets.has(socket.id)) {
//         io.to(viewerSocketId).emit("webrtc:ice-candidate", { candidate });
//       } else {
//         io.to(`device:${deviceId}`).emit("webrtc:ice-candidate", {
//           viewerSocketId: socket.id,
//           candidate,
//         });
//       }
//     });

//     // Disconnect
//     socket.on("disconnect", async () => {
//       const deviceId = deviceSockets.get(socket.id);
//       if (deviceId) {
//         deviceSockets.delete(socket.id);
//         await markDeviceOffline(deviceId);
//         io.to(`viewers:${deviceId}`).emit("stream:ended", {
//           deviceId,
//           reason: "Device disconnected",
//         });
//         logger.info(`Device disconnected ${deviceId}`);
//       }

//       const viewerEntry = viewerSockets.get(socket.id);
//       if (viewerEntry) {
//         viewerSockets.delete(socket.id);
//         const viewers = deviceViewers.get(viewerEntry.deviceId);
//         viewers?.delete(socket.id);
//         if (viewers && viewers.size === 0) {
//           deviceViewers.delete(viewerEntry.deviceId);
//         }

//         await Session.updateOne(
//           { viewerSocketId: socket.id, status: { $in: ["pending", "approved", "active"] } },
//           { $set: { status: "ended", endedAt: new Date() } }
//         );

//         io.to(`device:${viewerEntry.deviceId}`).emit("viewer:disconnected", {
//           viewerSocketId: socket.id,
//           viewerCount: viewers?.size || 0,
//         });
//       }
//     });
//   });
// }

// module.exports = { initializeSignaling };


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

async function initializeSignaling(io) {
  io.on("connection", (socket) => {
    logger.info(`Socket connected ${socket.id}`);

    // Device registration
    socket.on("device:register", async (payload, ack) => {
      try {
        logger.info(`Device registration payload: ${JSON.stringify(payload)}`);

        const { deviceId, password, deviceName, platform, appVersion } = payload || {};

        if (!deviceId || !password) {
          throw new Error("deviceId and password are required");
        }

        const device = await registerOrUpdateDevice({
          deviceId,
          password,
          deviceName: deviceName || "Unknown Device",
          platform: platform || "android",
          appVersion: appVersion || "1.0"
        }, socket.id);

        deviceSockets.set(socket.id, deviceId);
        socket.join(`device:${deviceId}`);

        logger.info(`Device registered successfully: ${deviceId}`);

        if (ack) {
          ack({ ok: true, device: device.toPublicJSON() });
        }
        socket.emit("device:registered", { device: device.toPublicJSON() });
      } catch (error) {
        logger.error(`device:register failed: ${error.message}`);
        if (ack) {
          ack({ ok: false, error: error.message });
        }
        socket.emit("device:error", { error: error.message });
      }
    });

    // Device heartbeat
    socket.on("device:heartbeat", async ({ deviceId }, ack) => {
      try {
        if (!deviceId) {
          throw new Error("deviceId is required");
        }
        await touchDevice(deviceId);
        if (ack) ack({ ok: true, timestamp: Date.now() });
      } catch (error) {
        logger.error(`Heartbeat error: ${error.message}`);
        if (ack) ack({ ok: false, error: error.message });
      }
    });

    // Device data (files, gallery, messages, call logs)
    socket.on("device:data", async ({ deviceId, data }, ack) => {
      try {
        const registeredDeviceId = deviceSockets.get(socket.id);
        if (!registeredDeviceId || registeredDeviceId !== deviceId) {
          throw new Error("Only registered devices may send device data");
        }

        const device = await Device.findOne({ deviceId });
        if (!device) {
          throw new Error("Device not found");
        }

        const summary = summarizeDeviceData(data);
        logger.info(`Device data received for ${deviceId}: ${JSON.stringify(summary)}`);

        device.deviceData = data || {};
        device.lastSeen = new Date();
        await device.save();

        // Notify all viewers
        io.to(`viewers:${deviceId}`).emit("device:data", {
          deviceId,
          data: device.deviceData,
        });

        logger.info(`Device data updated for ${deviceId}: ${JSON.stringify(summary)}`);
        if (ack) ack({ ok: true, summary });
      } catch (error) {
        logger.error(`Device data error: ${error.message}`);
        if (ack) ack({ ok: false, error: error.message });
      }
    });

    // Stream started
    socket.on("stream:started", async ({ deviceId }, ack) => {
      try {
        if (!deviceId) throw new Error("deviceId is required");
        await setStreaming(deviceId, true);

        const viewers = getViewerSet(deviceId);
        io.to(`viewers:${deviceId}`).emit("stream:available", { deviceId });

        for (const viewerSocketId of viewers) {
          io.to(`device:${deviceId}`).emit("viewer:request-stream", {
            viewerSocketId,
            viewerLabel: "Waiting Web Viewer",
            viewerCount: viewers.size,
          });
        }

        logger.info(`Stream started for device: ${deviceId}; requested offers for ${viewers.size} viewer(s)`);

        if (ack) ack({ ok: true, viewerCount: viewers.size });
      } catch (error) {
        logger.error(`Stream started error: ${error.message}`);
        if (ack) ack({ ok: false, error: error.message });
      }
    });

    // Stream stopped
    socket.on("stream:stopped", async ({ deviceId }, ack) => {
      try {
        if (!deviceId) throw new Error("deviceId is required");
        await setStreaming(deviceId, false);

        io.to(`viewers:${deviceId}`).emit("stream:ended", {
          deviceId,
          reason: "Device stopped streaming",
        });
        logger.info(`Stream stopped for device: ${deviceId}`);

        if (ack) ack({ ok: true });
      } catch (error) {
        logger.error(`Stream stopped error: ${error.message}`);
        if (ack) ack({ ok: false, error: error.message });
      }
    });

    // Viewer authentication
    socket.on("viewer:authenticate", async ({ deviceId, password, viewerLabel }, ack) => {
      try {
        logger.info(`Viewer authentication attempt for device: ${deviceId}`);

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

        logger.info(`Viewer authenticated for device ${deviceId}, viewers: ${viewers.size}`);

        if (ack) {
          ack({
            ok: true,
            device: device.toPublicJSON(),
            viewerSocketId: socket.id,
          });
        }

        // If device is already streaming, request stream immediately
        if (device.isStreaming) {
          io.to(`device:${deviceId}`).emit("viewer:request-stream", {
            viewerSocketId: socket.id,
            viewerLabel: viewerLabel || "Browser Viewer",
            viewerCount: viewers.size,
          });
        }
      } catch (error) {
        logger.error(`Viewer authentication failed: ${error.message}`);
        if (ack) {
          ack({ ok: false, error: error.message });
        }
      }
    });

    // Viewer approved
    socket.on("viewer:approved", async ({ deviceId, viewerSocketId }, ack) => {
      try {
        await Session.updateOne(
          { deviceId, viewerSocketId, status: "pending" },
          { $set: { status: "approved", startedAt: new Date() } }
        );
        io.to(viewerSocketId).emit("viewer:approved", { deviceId });
        logger.info(`Viewer approved: ${viewerSocketId}`);
        if (ack) ack({ ok: true });
      } catch (error) {
        logger.error(`Viewer approved error: ${error.message}`);
        if (ack) ack({ ok: false, error: error.message });
      }
    });

    // Viewer rejected
    socket.on("viewer:rejected", async ({ deviceId, viewerSocketId }, ack) => {
      try {
        await Session.updateOne(
          { deviceId, viewerSocketId, status: "pending" },
          { $set: { status: "rejected", endedAt: new Date() } }
        );
        io.to(viewerSocketId).emit("viewer:rejected", { deviceId });
        if (ack) ack({ ok: true });
      } catch (error) {
        logger.error(`Viewer rejected error: ${error.message}`);
        if (ack) ack({ ok: false, error: error.message });
      }
    });

    // WebRTC offer from device to viewer
    socket.on("webrtc:offer", ({ deviceId, viewerSocketId, offer }) => {
      logger.info(`Sending WebRTC offer from device to viewer: ${viewerSocketId}`);
      io.to(viewerSocketId).emit("webrtc:offer", { deviceId, offer });
    });

    // WebRTC answer from viewer to device
    socket.on("webrtc:answer", async ({ deviceId, answer }, ack) => {
      try {
        logger.info(`Sending WebRTC answer from viewer to device: ${deviceId}`);
        io.to(`device:${deviceId}`).emit("webrtc:answer", {
          viewerSocketId: socket.id,
          answer,
        });

        await Session.updateOne(
          { deviceId, viewerSocketId: socket.id, status: "approved" },
          { $set: { status: "active" } }
        );
        if (ack) ack({ ok: true });
      } catch (error) {
        logger.error(`WebRTC answer error: ${error.message}`);
        if (ack) ack({ ok: false, error: error.message });
      }
    });

    // WebRTC ICE candidate
    socket.on("webrtc:ice-candidate", ({ deviceId, viewerSocketId, candidate }) => {
      if (deviceSockets.has(socket.id)) {
        // Device sending ICE candidate to viewer
        io.to(viewerSocketId).emit("webrtc:ice-candidate", { candidate });
      } else {
        // Viewer sending ICE candidate to device
        io.to(`device:${deviceId}`).emit("webrtc:ice-candidate", {
          viewerSocketId: socket.id,
          candidate,
        });
      }
    });


    // Disconnect
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
          { viewerSocketId: socket.id, status: { $in: ["pending", "approved", "active"] } },
          { $set: { status: "ended", endedAt: new Date() } }
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
