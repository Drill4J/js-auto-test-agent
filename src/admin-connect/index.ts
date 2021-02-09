import axios, { AxiosError } from 'axios';
import LoggerProvider from '../util/logger';
import { v4 as uuid } from 'uuid';
import { SessionActionError } from './session-action-error';

export enum AdminMessage {
  START = 'START',
  STOP = 'STOP',
}

export enum TestType {
  AUTO = 'AUTO',
}

const logger = LoggerProvider.getLogger('drill', 'admin');
const AUTH_TOKEN_HEADER_NAME = 'Authorization';

export default async (backendUrl: string, agentId?: string, groupId?: string) => {
  logger.debug('logging in...');
  await setupAxios(backendUrl);
  logger.debug('logged in!');

  let route = 'agents';
  let id = agentId;
  if (groupId) {
    route = 'service-groups';
    id = groupId;
  }
  const test2CodeRoute = `/${route}/${id}/plugins/test2code/dispatch-action`;
  logger.debug(`test2code route ${test2CodeRoute}`);

  return {
    async startSession() {
      const sessionId = uuid();
      await axiosPost(test2CodeRoute, {
        type: AdminMessage.START,
        payload: {
          sessionId,
          testType: TestType.AUTO,
          isRealtime: true,
        },
      });
      return sessionId;
    },

    async stopSession(sessionId: string) {
      await axiosPost(test2CodeRoute, {
        type: AdminMessage.STOP,
        payload: { sessionId },
      });
    },
  };
};

function ensureProtocol(url: string) {
  const hasProtocol = url.indexOf('http') > -1 || url.indexOf('https') > -1;
  if (!hasProtocol) {
    return `http://${url}`;
  }
  return url;
}

async function setupAxios(backendUrl: string) {
  axios.defaults.baseURL = `${ensureProtocol(backendUrl)}/api/`;

  const authToken = await login();

  axios.interceptors.request.use(async config => {
    // eslint-disable-next-line no-param-reassign
    config.headers[AUTH_TOKEN_HEADER_NAME] = `Bearer ${authToken}`;
    return config;
  });

  return authToken;
}

async function login() {
  const { headers } = await axios.post('/login');
  const authToken = headers[AUTH_TOKEN_HEADER_NAME.toLowerCase()];
  if (!authToken) throw new Error('Drill backend authentication failed');
  return authToken;
}

async function axiosPost(baseUrl: string, payload: unknown) {
  let data;
  try {
    logger.debug('send %s %o', baseUrl, payload);
    const res = await axios.post(baseUrl, payload);
    data = res?.data;
  } catch (e) {
    // FIXME this is specific to session actions, might as well move it elsewhere or rename a function
    if (isAxiosError(e)) {
      if (e.response?.data?.code === 404) {
        throw new SessionActionError(e.response?.data?.message, (payload as any).payload.sessionId);
      }
    }

    throw new Error(getErrorMessage(e));
  }

  if (Array.isArray(data)) {
    if (!data.some(x => x.code === 200)) {
      // TODO change when we will figure out SG actions handling
      throw new Error('unexpected error');
    }
  } else if (data.code !== 200) {
    // TODO if backend always sets correct status codes that must not happen
    throw new Error('unexpected error');
  }
  return data;
}

function getErrorMessage(e: unknown): string {
  if (typeof e === 'string') return e;

  if (typeof e === 'object') {
    if (isAxiosError(e)) {
      if (e.response?.data?.message) {
        return e.response.data.message;
      }
      if (e.response?.status === 400) {
        return 'bad request';
      }
      if (e.response?.status === 500) {
        return 'internal server error';
      }
    }
  }

  logger.error('unexpected error %o', e);
  return 'unexpected error';
}

function isAxiosError(e: unknown): e is AxiosError {
  if (e && (e as any).isAxiosError) return true;
  return false;
}
