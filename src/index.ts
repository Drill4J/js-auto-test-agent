import * as environment from 'browser-or-node';
import adminConnect from './admin-connect';
import dispatcherConnect, { DispatcherConnectOptions, StubDispatcher } from './dispatcher-connect';
import getSettings from './settings';

export interface AutotestAgent {
  sessionId: string;
  startTest: (testName: any) => Promise<void>;
  finishTest: (testName: any) => Promise<void>;
  destroy: () => Promise<void>;
}

export type AutotestAgentOptions = {
  adminUrl: string;
  agentId: string;
  groupId?: string;
  dispatcherUrl?: string;
} & DispatcherConnectOptions;

export default async function (options: AutotestAgentOptions): Promise<Promise<AutotestAgent>> {
  console.log(
    '@drill4j/js-auto-test-agent: this package utilizes debug module (https://www.npmjs.com/package/debug). Add "drill:*" prefix to see debug info',
  );
  const settings = getSettings(options);

  const { adminUrl, agentId, groupId } = settings;
  const admin = await adminConnect(adminUrl, agentId, groupId);

  const { dispatcherUrl, ...dispatcherOptions } = settings;
  const dispatcher = await createDispatcher(dispatcherUrl, dispatcherOptions);

  return (async () => {
    await dispatcher.ready;
    const sessionId = await admin.startSession();
    return {
      sessionId,
      startTest: async (testName: any) => dispatcher.startTest(sessionId, testName),
      finishTest: async (testName: any) => dispatcher.finishTest(sessionId, testName),
      destroy: async () => {
        await dispatcher.destroy();
        await admin.stopSession(sessionId);
      },
    };
  })();
}

async function createDispatcher(dispatcherUrl, options) {
  if (dispatcherUrl) {
    return await dispatcherConnect(dispatcherUrl, options);
  }
  const msg = `@drill4j/js-auto-test-agent: dispatcher is not initiated: ${
    environment.isNode ? 'DRILL_DISPATCHER_URL is not specified in env variables' : 'dispatcherUrl is not specified in options'
  }`;
  return StubDispatcher(msg);
}
