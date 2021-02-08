import { ILogger } from 'util/logger';
import WebSocket from 'ws';

export function createMessageAwaiter(socket: WebSocket, logger: ILogger) {
  return (messageType: string, timeout?) => socketMessage(socket, logger, messageType, timeout);
}

export async function socketEvent(socket: WebSocket, event, timeout = 10000): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    socket.on(event, (...args: unknown[]) => {
      resolve(args);
    });
    setTimeout(() => reject(new Error(`"${event}" event timed out: ${timeout}ms`)), timeout);
  });
}

export async function socketMessage(socket: any, logger: ILogger, type: string, timeout = 10000) {
  return new Promise((resolve, reject) => {
    socket.on('message', (message: string) => {
      try {
        logger.debug('received message %o', message);
        const data = JSON.parse(message);
        if (data && data.type === type) {
          resolve(data.payload);
        }
      } catch (e) {
        logger.error('failed to parse message %o', message);
      }
    });
    setTimeout(() => reject(new Error(`"${type}" message timed out: ${timeout}ms`)), timeout);
  });
}
