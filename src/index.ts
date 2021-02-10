import adminConnect from './admin-connect';
import dispatcherConnect from './dispatcher-connect';

export interface AutotestAgent {
  startTest: (testName: any) => Promise<void>;
  finishTest: (testName: any) => Promise<void>;
  destroy: () => Promise<void>;
}

export default async (): Promise<Promise<AutotestAgent>> => {
  const { agentId, groupId, adminUrl, dispatcherUrl, clientId, dispatcherConnectTimeout, extensionReadyTimeout } = getSettingsFromEnvVars();
  const admin = await adminConnect(adminUrl, agentId, groupId);
  const dispatcher = await dispatcherConnect(dispatcherUrl, { clientId, connectTimeout: dispatcherConnectTimeout, extensionReadyTimeout });
  return (async () => {
    await dispatcher.ready;
    const sessionId = await admin.startSession();
    return {
      startTest: async (testName: any) => dispatcher.startTest(sessionId, testName),
      finishTest: async (testName: any) => dispatcher.finishTest(sessionId, testName),
      destroy: async () => {
        await dispatcher.destroy();
        await admin.stopSession(sessionId);
      },
    };
  })();
};

function getSettingsFromEnvVars() {
  const agentId = process.env.DRILL_AGENT_ID;
  const groupId = process.env.DRILL_GROUP_ID;
  const adminUrl = process.env.DRILL_ADMIN_URL;
  const dispatcherUrl = process.env.DRILL_DISPATCHER_URL;
  const clientId = process.env.DRILL_CLIENT_ID;
  const dispatcherConnectTimeout =
    (process.env.DRILL_DISPATCHER_CONNECT_TIMEOUT_MS && parseInt(process.env.DRILL_DISPATCHER_CONNECT_TIMEOUT_MS)) || 20000;
  const extensionReadyTimeout =
    (process.env.DRILL_EXTENSION_READY_TIMEOUT_MS && parseInt(process.env.DRILL_EXTENSION_READY_TIMEOUT_MS)) || 60000;
  if (!agentId && !groupId) {
    throw new Error('Please specify either DRILL_AGENT_ID or DRILL_GROUP_ID in env variables');
  }
  if (!adminUrl) {
    throw new Error('Please specify DRILL_ADMIN_URL in env variables');
  }
  if (!dispatcherUrl) {
    throw new Error('Please specify DRILL_DISPATCHER_URL in env variables');
  }
  return { agentId, groupId, adminUrl, dispatcherUrl, clientId, dispatcherConnectTimeout, extensionReadyTimeout };
}
