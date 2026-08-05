import { logger } from '@utils';
import express, { Request, Response } from 'express';
import { WebSocketServer } from 'ws';

import { processAttendancePunch, processFactoryAttendancePunch } from '../services/punch-processors.ts';

const METHOD_MAP: Record<string, string> = {
  FP: 'Fingerprint',
  FACE: 'Face',
  CD: 'Card',
  CARD: 'Card',
  PWD: 'Password',
};

export function setupDeviceHandlers(app: express.Express, server: any) {
  // PT-5000 HTTP Device Route
  app.post('/', async (req: Request, res: Response) => {
    const requestCode = req.headers['request_code'] as string;
    const devId = (req.headers['dev_id'] as string) || 'UNKNOWN';
    const transId = (req.headers['trans_id'] as string) || 'ReceiveCommandAction';

    // 1. Read raw stream into a Buffer
    const buffers: Buffer[] = [];
    for await (const chunk of req) {
      buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const rawBuffer = Buffer.concat(buffers);
    const rawString = rawBuffer.toString('utf8');

    // 2. Extract clean JSON by locating the first '{' and last '}'
    let payload: Record<string, unknown> = {};
    try {
      const jsonStart = rawString.indexOf('{');
      const jsonEnd = rawString.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        payload = JSON.parse(rawString.substring(jsonStart, jsonEnd + 1));
      }
    } catch (err: unknown) {
      logger.error('âšŒ Failed to parse device payload JSON:', err);
    }

    // 3. Handle Heartbeat
    if (requestCode === 'receive_cmd') {
      logger.info(`ðŸ’“ [HEARTBEAT] Factory Attendance Device is Online.)`);
    }

    // 4. Handle Attendance Punch
    if (requestCode === 'realtime_glog' || payload.user_id) {
      const userId = payload.user_id as string;
      const rawTime = payload.io_time as string; // e.g., "20000328104051"
      const verifyMode = payload.verify_mode as string;

      // Format timestamp: "20000328104051" -> "2000-03-28 10:40:51"
      let formattedTime: string;

      if (rawTime && rawTime.length >= 14) {
        formattedTime = `${rawTime.substring(0, 4)}-${rawTime.substring(4, 6)}-${rawTime.substring(6, 8)} ${rawTime.substring(8, 10)}:${rawTime.substring(10, 12)}:${rawTime.substring(12, 14)}`;
      } else {
        const options = { timeZone: 'UTC', hour12: false };
        const d = new Date();
        const datePart = d.toLocaleDateString('en-CA', options); // outputs YYYY-MM-DD
        const timePart = d.toLocaleTimeString('en-GB', options); // outputs HH:mm:ss
        formattedTime = `${datePart} ${timePart}`;
      }

      const scanMethod = String(verifyMode ?? 'Unknown');

      if (userId) {
        await processFactoryAttendancePunch({
          userId: String(userId),
          punchTime: formattedTime,
          scanMethod,
          deviceLabel: `PT-5000 Factory ${devId}`,
        });
      }
    }

    // Always acknowledge the device with required headers
    res.setHeader('response_code', 'OK');
    res.setHeader('trans_id', transId);
    return res.status(200).send('OK');
  });

  // Integrated WebSocket Server for the biometric attendance device (Pioneer XML Bridge)
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: any, socket: any, head: any) => {
    // Handle websocket upgrade
    wss.handleUpgrade(request, socket, head, (ws: any) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws: any, req: any) => {
    logger.info(`ðŸ“¡ [DEVICE CONNECTED] Connection open from IP: ${req.socket.remoteAddress}`);

    logger.info('Device connected', {
      ip: req.socket.remoteAddress,
      firmware: ws.upgrade?.request?.headers?.['x-device-firmware'] || 'unknown',
    });
    ws.on('message', async (message: any) => {
      const rawString = message.toString('utf8').trim();

      const serialNoMatch = rawString.match(/<DeviceSerialNo>(.*?)<\/DeviceSerialNo>/);
      const serialNo = serialNoMatch ? serialNoMatch[1] : 'RSS20230560326';

      // 1. HANDSHAKE STEP 1: Registration
      if (rawString.includes('<Request>Register</Request>')) {
        const xmlResponse = `<?xml version="1.0"?>\r\n<Message>\r\n<Response>Register</Response>\r\n<Result>OK</Result>\r\n<DeviceSerialNo>${serialNo}</DeviceSerialNo>\r\n</Message>`;
        return ws.send(xmlResponse);
      }

      // 2. HANDSHAKE STEP 2: Login
      if (rawString.includes('<Request>Login</Request>')) {
        const sessionToken = `TOKEN_${Date.now()}`;
        const xmlLoginResponse = `<?xml version="1.0"?>\r\n<Message>\r\n<Response>Login</Response>\r\n<Result>OK</Result>\r\n<DeviceSerialNo>${serialNo}</DeviceSerialNo>\r\n<Token>${sessionToken}</Token>\r\n</Message>`;
        return ws.send(xmlLoginResponse);
      }

      // 3. MANAGEMENT LOG HOOK (OpLog_v2)
      if (rawString.includes('OpLog_v2')) {
        try {
          const transId = rawString.match(/<TransID>(.*?)<\/TransID>/)?.[1] || '0';
          const logId = rawString.match(/<LogID>(.*?)<\/LogID>/)?.[1] || '0';
          const xmlOpResponse = `<?xml version="1.0"?>\r\n<Message>\r\n<Response>OpLog_v2</Response>\r\n<Result>OK</Result>\r\n<DeviceSerialNo>${serialNo}</DeviceSerialNo>\r\n<TransID>${transId}</TransID>\r\n<LogID>${logId}</LogID>\r\n</Message>`;
          ws.send(xmlOpResponse);
        } catch (err: unknown) {
          logger.error('âšŒ [ERROR] Processing Management Log:', err);
        }
        return;
      }
      // 4. LIVE ATTENDANCE PUNCH CAPTURE (TimeLog_v2 Event Core)
      if (rawString.includes('TimeLog_v2')) {
        try {
          const userId = rawString.match(/<UserID>(.*?)<\/UserID>/)?.[1];
          const punchTime = rawString.match(/<Time>(.*?)<\/Time>/)?.[1];
          const actionRaw = rawString.match(/<Action>(.*?)<\/Action>/)?.[1] || 'FACE';
          const attendStat = rawString.match(/<AttendStat>(.*?)<\/AttendStat>/)?.[1] || 'None';
          const transId = rawString.match(/<TransID>(.*?)<\/TransID>/)?.[1] || '0';
          const logId = rawString.match(/<LogID>(.*?)<\/LogID>/)?.[1] || '0';

          if (userId && punchTime) {
            const xmlLogResponse = `<?xml version="1.0"?>\r\n<Message>\r\n<Response>TimeLog_v2</Response>\r\n<Result>OK</Result>\r\n<DeviceSerialNo>${serialNo}</DeviceSerialNo>\r\n<TransID>${transId}</TransID>\r\n<LogID>${logId}</LogID>\r\n</Message>`;
            ws.send(xmlLogResponse);

            const scanMethod = METHOD_MAP[actionRaw.toUpperCase()] || actionRaw;

            await processAttendancePunch({
              userId,
              punchTime,
              scanMethod,
              attendStat,
              deviceLabel: `WebSocket (${serialNo})`,
            });
          }
        } catch (err: unknown) {
          logger.error('âšŒ [ERROR] Parsing XML Data Block:', err);
        }
        return;
      }

      // 5. HEARTBEAT MANAGER
      if (rawString.includes('<Request>Heartbeat</Request>') || rawString.includes('Heartbeat')) {
        logger.info('ðŸ’“ [SOCKET HEARTBEAT] HQ Attendance Device is online.');
        const xmlHeartbeatResponse = `<?xml version="1.0"?>\r\n<Message>\r\n<Response>Heartbeat</Response>\r\n<Result>OK</Result>\r\n</Message>`;
        return ws.send(xmlHeartbeatResponse);
      }
    });

    ws.on('close', () => logger.info('ðŸ”Œ [DEVICE DISCONNECTED] Channel closed.'));
  });
}
