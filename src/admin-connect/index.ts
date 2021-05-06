import axios, { AxiosError } from 'axios';
import LoggerProvider from '../util/logger';
import { v4 as uuid } from 'uuid';
import { SessionActionError } from './session-action-error';

export enum AdminMessage {
  START = 'START',
  STOP = 'STOP',
  ADD_TESTS = 'ADD_TESTS',
}

export enum TestType {
  AUTO = 'AUTO',
}

export enum TestResult {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  ERROR = 'ERROR',
  UNKNOWN = 'UNKNOWN',
}

type TestRun = {
  name: string;
  startedAt: number;
  finishedAt: number;
  tests: TestInfo[];
};

export type TestInfo = {
  name: string;
  result: TestResult;
  startedAt: number;
  finishedAt: number;
};

const logger = LoggerProvider.getLogger('drill', 'admin');
const AUTH_TOKEN_HEADER_NAME = 'Authorization';

export default async (backendUrl: string, agentId?: string, groupId?: string) => {
  logger.info('logging in...');
  try {
    await setupAxios(backendUrl);
  } catch (e) {
    logger.error('o%', e);
    throw e;
  }
  logger.debug('logged in!');
  const test2CodeRoute = getTest2CodeApiRoute(agentId, groupId);
  logger.info(`test2code route ${test2CodeRoute}`);

  return {
    async startSession() {
      const sessionId = uuid();
      await sendSessionAction(test2CodeRoute, {
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
      await sendSessionAction(test2CodeRoute, {
        type: AdminMessage.STOP,
        payload: { sessionId },
      });
    },

    async addTests(sessionId: string, tests: TestInfo[]) {
      const startedAt = findMin('startedAt')(tests);
      const finishedAt = findMax('finishedAt')(tests);

      const payload: { sessionId: string; testRun: TestRun } = {
        sessionId,
        testRun: {
          name: '',
          startedAt,
          finishedAt,
          tests,
        },
      };
      await sendSessionAction(test2CodeRoute, {
        type: AdminMessage.ADD_TESTS,
        payload,
      });
    },
  };
};

function getTest2CodeApiRoute(agentId, groupId) {
  let route;
  let id;
  if (agentId) {
    route = 'agents';
    id = agentId;
  } else if (groupId) {
    route = 'service-groups';
    id = groupId;
  } else {
    throw new Error('@drill4j/js-auto-test-agent: failed to connect to backend: no agentId or groupId provided');
  }

  return `/${route}/${id}/plugins/test2code/dispatch-action`;
}

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
  if (!authToken) throw new Error('@drill4j/js-auto-test-agent: backend authentication failed');
  return authToken;
}

async function sendSessionAction(baseUrl: string, payload: unknown) {
  let data;
  try {
    const res = await axios.post(baseUrl, payload);
    data = res?.data;

    if (Array.isArray(data)) {
      const atLeastOneOperationIsSuccessful = data.some((x: any) => x.code === 200);
      if (!atLeastOneOperationIsSuccessful) throw new Error(stringify(data));
    }
  } catch (e) {
    throw new SessionActionError(getErrorMessage(e), (payload as any).payload.sessionId);
  }
}

function getErrorMessage(e: any): string {
  const defaultMessage = 'unexpected error';
  if (e?.isAxiosError && e.response?.data?.message) {
    return e.response?.data?.message;
  }
  if (e?.message) {
    return e.message;
  }
  return `@drill4j/js-auto-test-agent: ${stringify(e) || defaultMessage}`;
}

function stringify(data: any) {
  try {
    return JSON.stringify(data);
  } catch (e) {
    return undefined;
  }
}

const prop = propName => object => object[propName];
const findMin = propName => arr => Math.min.apply(null, arr.map(prop(propName)));
const findMax = propName => arr => Math.max.apply(null, arr.map(prop(propName)));
