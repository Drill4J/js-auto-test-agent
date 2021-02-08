import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import LoggerProvider, { ILogger } from '../util/logger';
import { createMessageAwaiter, socketEvent } from './socket-utils';
const logger = LoggerProvider.getLogger('drill', 'dispatcher');

export enum DispatcherMessage {
  CONNECT = 'CONNECT',
  START_TEST = 'START_TEST',
  FINISH_TEST = 'FINISH_TEST',
}

export enum IncomingMessage {
  READY = 'READY',
  CONNECT = 'CONNECT',
  START_TEST = 'START_TEST',
  FINISH_TEST = 'FINISH_TEST',
}

export default async function connect(url: string | URL, connectTimeout?) {
  logger.info('connecting...');

  const socket = new WebSocket(url);
  await socketEvent(socket, 'open', connectTimeout);
  logger.debug('connection open!');

  const clientId = uuidv4();
  logger.debug(`client id: ${clientId}`);
  const send = createSender(socket, clientId, logger);

  logger.debug('sending connect message...');
  await send(DispatcherMessage.CONNECT);
  logger.debug('connect message sent!');

  logger.info('ready!');

  return {
    ready: createMessageAwaiter(socket, logger)(IncomingMessage.READY),
    startTest: async (sessionId: string, testName: string) => send(DispatcherMessage.START_TEST, { testName, sessionId }),
    finishTest: async (sessionId: string, testName: string) => send(DispatcherMessage.FINISH_TEST, { testName, sessionId }),
    destroy: async () => {
      const closePromise = socketEvent(socket, 'close');
      socket.close(1000);
      return closePromise;
    },
  };
}

function createSender(socket: WebSocket, clientId: string, logger: ILogger) {
  return async (
    type: DispatcherMessage,
    payload: unknown = {},
    timeout = parseInt(process.env.DRILL_MESSAGE_TIMEOUT) || 10000,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      socket.on('message', (raw: string) => {
        try {
          const { type: responseType, payload } = JSON.parse(raw);
          logger.debug(`"${responseType}" - response %o`, payload);
          if (responseType === type) {
            resolve(payload);
          }
        } catch (e) {
          logger.error(`failed to process "${type}" response %o`, e);
        }
      });

      logger.debug(`${type} - send`);
      socket.send(
        JSON.stringify({
          type,
          from: {
            id: clientId,
            type: 'autotest-agent',
          },
          payload,
        }),
      );
      setTimeout(() => reject(new Error(`"${type}" response timed out: ${timeout}ms`)), timeout);
    });
  };
}
