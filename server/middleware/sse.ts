import { Response } from 'express';

class SSEManager {
  private clients = new Map<Response, { lastSeen: number; userId?: string }>();
  private readonly maxClients = 200;
  private readonly heartbeatMs = 15000;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor() {
    this.startHeartbeat();
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const [client, meta] of this.clients) {
        if (now - meta.lastSeen > this.heartbeatMs * 3) {
          this.remove(client);
        }
      }
    }, this.heartbeatMs);
  }

  add(res: Response, userId?: string) {
    if (this.clients.size >= this.maxClients) {
      res.write(`data: ${JSON.stringify({ error: 'Server at capacity' })}\n\n`);
      res.end();
      return;
    }
    this.clients.set(res, { lastSeen: Date.now(), userId });

    res.on('close', () => this.remove(res));
    res.on('error', () => this.remove(res));
  }

  remove(res: Response) {
    this.clients.delete(res);
    try {
      res.end();
    } catch {
      // ignore
    }
  }

  broadcast(message: string, excludeUserId?: string) {
    const now = Date.now();
    for (const [client, meta] of this.clients) {
      if (excludeUserId && meta.userId === excludeUserId) continue;
      meta.lastSeen = now;
      try {
        client.write(message);
      } catch {
        this.remove(client);
      }
    }
  }

  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    for (const client of this.clients.keys()) {
      this.remove(client);
    }
  }
}

export const sseClients = new SSEManager();
