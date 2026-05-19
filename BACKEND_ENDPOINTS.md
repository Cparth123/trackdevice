# Backend Endpoint List

Base URL:

```text
http://localhost:4000
```

## REST Endpoints

### Health Check

```http
GET /health
```

Response:

```json
{
  "status": "ok",
  "time": "2026-05-19T17:23:46.472Z",
  "uptime": 7.0023678
}
```

### ICE Servers

```http
GET /api/ice-servers
```

Response:

```json
{
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" },
    { "urls": "stun:stun1.l.google.com:19302" }
  ]
}
```

If TURN is configured in `.env`, the TURN server is included in this response.

### Register Device

```http
POST /api/devices/register
```

Body:

```json
{
  "deviceId": "SS-ABCDEFGH",
  "password": "123456",
  "deviceName": "My Android Device",
  "platform": "android",
  "appVersion": "1.0.0"
}
```

Response:

```json
{
  "success": true,
  "device": {
    "deviceId": "SS-ABCDEFGH",
    "deviceName": "My Android Device",
    "platform": "android",
    "appVersion": "1.0.0",
    "isOnline": true,
    "isStreaming": false,
    "lastSeen": "2026-05-19T17:23:46.472Z",
    "totalSessions": 0
  }
}
```

### List Devices

```http
GET /api/devices
```

Response:

```json
{
  "count": 1,
  "devices": [
    {
      "deviceId": "SS-ABCDEFGH",
      "deviceName": "My Android Device",
      "platform": "android",
      "appVersion": "1.0.0",
      "isOnline": true,
      "isStreaming": false,
      "lastSeen": "2026-05-19T17:23:46.472Z",
      "totalSessions": 0
    }
  ]
}
```

### Device Status

```http
GET /api/devices/:deviceId/status
```

Example:

```http
GET /api/devices/SS-ABCDEFGH/status
```

Response:

```json
{
  "deviceId": "SS-ABCDEFGH",
  "deviceName": "My Android Device",
  "platform": "android",
  "appVersion": "1.0.0",
  "isOnline": true,
  "isStreaming": true,
  "lastSeen": "2026-05-19T17:23:46.472Z",
  "totalSessions": 0
}
```

### Update Stream State

```http
POST /api/devices/:deviceId/stream
```

Example:

```http
POST /api/devices/SS-ABCDEFGH/stream
```

Body:

```json
{
  "password": "123456",
  "isStreaming": true
}
```

Response:

```json
{
  "success": true,
  "device": {
    "deviceId": "SS-ABCDEFGH",
    "isOnline": true,
    "isStreaming": true
  }
}
```

### Update Device Password

```http
POST /api/devices/:deviceId/password
```

Example:

```http
POST /api/devices/SS-ABCDEFGH/password
```

Body:

```json
{
  "oldPassword": "123456",
  "newPassword": "654321"
}
```

Response:

```json
{
  "success": true,
  "device": {
    "deviceId": "SS-ABCDEFGH",
    "isOnline": true,
    "isStreaming": false
  }
}
```

### Verify Device Password

```http
POST /api/devices/:deviceId/verify
```

Example:

```http
POST /api/devices/SS-ABCDEFGH/verify
```

Body:

```json
{
  "password": "123456"
}
```

Response:

```json
{
  "valid": true,
  "device": {
    "deviceId": "SS-ABCDEFGH",
    "deviceName": "My Android Device",
    "platform": "android",
    "appVersion": "1.0.0",
    "isOnline": true,
    "isStreaming": true,
    "lastSeen": "2026-05-19T17:23:46.472Z",
    "totalSessions": 0
  }
}
```

### Session History

```http
GET /api/sessions/:deviceId
```

Example:

```http
GET /api/sessions/SS-ABCDEFGH
```

Response:

```json
{
  "sessions": []
}
```

### Active Sessions

```http
GET /api/sessions/:deviceId/active
```

Example:

```http
GET /api/sessions/SS-ABCDEFGH/active
```

Response:

```json
{
  "count": 1,
  "sessions": []
}
```

## Socket.io URL

```text
http://localhost:4000
```

## Device Socket Events

### device:register

Direction:

```text
Device -> Server
```

Payload:

```json
{
  "deviceId": "SS-ABCDEFGH",
  "password": "123456",
  "deviceName": "My Android Device",
  "platform": "android",
  "appVersion": "1.0.0"
}
```

Ack:

```json
{
  "ok": true,
  "device": {}
}
```

### device:heartbeat

Direction:

```text
Device -> Server
```

Payload:

```json
{
  "deviceId": "SS-ABCDEFGH"
}
```

### stream:started

Direction:

```text
Device -> Server
```

Payload:

```json
{
  "deviceId": "SS-ABCDEFGH"
}
```

### stream:stopped

Direction:

```text
Device -> Server
```

Payload:

```json
{
  "deviceId": "SS-ABCDEFGH"
}
```

### viewer:approved

Direction:

```text
Device -> Server
```

Payload:

```json
{
  "deviceId": "SS-ABCDEFGH",
  "viewerSocketId": "viewer_socket_id"
}
```

### viewer:rejected

Direction:

```text
Device -> Server
```

Payload:

```json
{
  "deviceId": "SS-ABCDEFGH",
  "viewerSocketId": "viewer_socket_id"
}
```

### webrtc:offer

Direction:

```text
Device -> Server -> Viewer
```

Payload:

```json
{
  "deviceId": "SS-ABCDEFGH",
  "viewerSocketId": "viewer_socket_id",
  "offer": {
    "type": "offer",
    "sdp": "..."
  }
}
```

### webrtc:ice-candidate

Direction:

```text
Device -> Server -> Viewer
```

Payload:

```json
{
  "deviceId": "SS-ABCDEFGH",
  "viewerSocketId": "viewer_socket_id",
  "candidate": {
    "candidate": "...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

## Viewer Socket Events

### viewer:authenticate

Direction:

```text
Viewer -> Server
```

Payload:

```json
{
  "deviceId": "SS-ABCDEFGH",
  "password": "123456",
  "viewerLabel": "Next.js Web Viewer"
}
```

Ack:

```json
{
  "ok": true,
  "device": {},
  "viewerSocketId": "viewer_socket_id"
}
```

### webrtc:answer

Direction:

```text
Viewer -> Server -> Device
```

Payload:

```json
{
  "deviceId": "SS-ABCDEFGH",
  "answer": {
    "type": "answer",
    "sdp": "..."
  }
}
```

### webrtc:ice-candidate

Direction:

```text
Viewer -> Server -> Device
```

Payload:

```json
{
  "deviceId": "SS-ABCDEFGH",
  "candidate": {
    "candidate": "...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

### viewer:disconnect-request

Direction:

```text
Viewer -> Server -> Device
```

Payload:

```json
{
  "deviceId": "SS-ABCDEFGH"
}
```

## Server Emitted Events

### To Device

```text
device:registered
device:error
viewer:request-stream
viewer:ready
webrtc:answer
webrtc:ice-candidate
viewer:disconnected
viewer:disconnect-request
```

### To Viewer

```text
viewer:approved
viewer:rejected
stream:available
stream:ended
webrtc:offer
webrtc:ice-candidate
```

## Quick Curl Tests

Health:

```powershell
curl http://localhost:4000/health
```

ICE servers:

```powershell
curl http://localhost:4000/api/ice-servers
```

List devices:

```powershell
curl http://localhost:4000/api/devices
```

Device status:

```powershell
curl http://localhost:4000/api/devices/SS-ABCDEFGH/status
```

Verify password:

```powershell
curl -Method POST http://localhost:4000/api/devices/SS-ABCDEFGH/verify -ContentType "application/json" -Body '{"password":"123456"}'
```
