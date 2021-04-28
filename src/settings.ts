import * as environment from 'browser-or-node';
import { AutotestAgentOptions } from 'index';

export default function getSettings(options) {
  let settings = {};
  if (environment.isNode) {
    settings = getSettingsFromProcessEnv();
  } else {
    settings = options;
  }

  validateSettings(settings);
  return settings as AutotestAgentOptions;
}

function validateSettings(settings) {
  if (!settings.agentId && !settings.groupId) {
    const msg = `@drill4j/js-auto-test-agent: please specify either ${
      environment.isNode ? 'DRILL_AGENT_ID or DRILL_GROUP_ID in env variables' : 'agentId or groupId in options'
    }`;
    throw new Error(msg);
  }
  if (!settings.adminUrl) {
    const msg = `@drill4j/js-auto-test-agent: please ${environment.isNode ? 'DRILL_ADMIN_URL in env variables' : 'adminUrl in options'}`;
    throw new Error(msg);
  }
}

function getSettingsFromProcessEnv() {
  const agentId = process.env.DRILL_AGENT_ID;
  const groupId = process.env.DRILL_GROUP_ID;
  const adminUrl = process.env.DRILL_ADMIN_URL;
  const dispatcherUrl = process.env.DRILL_DISPATCHER_URL;
  const clientId = process.env.DRILL_CLIENT_ID;
  const dispatcherConnectTimeout = parseInt(process.env.DRILL_DISPATCHER_CONNECT_TIMEOUT_MS);
  const extensionReadyTimeout = parseInt(process.env.DRILL_EXTENSION_READY_TIMEOUT_MS);
  const testActionsTimeout = parseInt(process.env.DRILL_TEST_ACTIONS_TIMEOUT_MS);
  return { agentId, groupId, adminUrl, dispatcherUrl, clientId, dispatcherConnectTimeout, extensionReadyTimeout, testActionsTimeout };
}
