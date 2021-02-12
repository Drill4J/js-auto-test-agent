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

type DispatcherConnectOptions = {
  connectTimeout?: number;
  extensionReadyTimeout?: number;
  testActionsTimeout?: number;
  clientId?: string | number;
};

export default async function connect(
  url: string | URL,
  { connectTimeout, clientId, extensionReadyTimeout, testActionsTimeout }: DispatcherConnectOptions = {},
) {
  logger.info('connecting...');

  const socket = new WebSocket(url);
  socket.on('error', error => logger.error('o%', error));
  await socketEvent(socket, 'open', connectTimeout);
  logger.debug('connection open!');

  const id = clientId || uuidv4();
  logger.debug(`client id: ${id}`);
  const send = createSender(socket, id, logger);

  logger.debug('sending connect message...');
  send(DispatcherMessage.CONNECT, undefined, undefined, false);
  logger.debug('connect message sent!');

  logger.info('ready!');

  return {
    ready: createMessageAwaiter(socket, logger)(IncomingMessage.READY, extensionReadyTimeout),
    startTest: async (sessionId: string, testName: string) =>
      send(DispatcherMessage.START_TEST, { testName, sessionId }, testActionsTimeout),
    finishTest: async (sessionId: string, testName: string) =>
      send(DispatcherMessage.FINISH_TEST, { testName, sessionId }, testActionsTimeout),
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
    mustWaitResponse = true,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      let timedOut = false;

      if (mustWaitResponse) {
        socket.on('message', (raw: string) => {
          try {
            const { type: responseType, payload } = JSON.parse(raw);
            logger.debug(`"${responseType}" - response %o`, payload);
            if (responseType === type) {
              if (timedOut) return;
              clearTimeout(timeoutTimer);
              resolve(payload);
            }
          } catch (e) {
            logger.error(`failed to process "${type}" response %o`, e);
          }
        });
      }

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

      if (!mustWaitResponse) resolve();

      const timeoutTimer = setTimeout(() => {
        reject(new Error(`"${type}" response timed out: ${timeout}ms`));
        timedOut = true;
      }, timeout);
    });
  };
}
