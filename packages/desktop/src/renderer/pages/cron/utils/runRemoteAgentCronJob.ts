/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { httpRequest } from '@/common/adapter/httpBridge';
import { resolveRemoteAgentToken } from '@renderer/pages/guid/utils/resolveRemoteAgentToken';
import type { RemoteAgentConfig } from '@/common/types/agent/remoteAgentTypes';

/**
 * Execute a remote-agent cron job by bypassing the backend's broken
 * `type: 'remote'` executor. Creates an `openclaw-gateway` conversation
 * directly and sends the payload message.
 *
 * Returns the created conversation id, or null if the agent could not be
 * resolved.
 */
export async function runRemoteAgentCronJob(params: {
  jobName: string;
  payloadText: string;
  workspace?: string;
  remoteAgents: RemoteAgentConfig[];
  agentName: string;
  cronJobId: string;
}): Promise<string | null> {
  const { jobName, payloadText, workspace, remoteAgents, agentName, cronJobId } = params;

  // Find the remote agent matching the job's agent name
  const agent = remoteAgents.find((ra) => ra.name === agentName);
  if (!agent) {
    throw new Error(`Remote agent not found: ${agentName}`);
  }

  // Parse host and port from the agent URL
  let remoteHost: string;
  let remotePort: string;
  try {
    const parsed = new URL(agent.url);
    remoteHost = parsed.hostname || '127.0.0.1';
    remotePort = parsed.port || '80';
  } catch {
    remoteHost = '127.0.0.1';
    remotePort = '80';
  }

  const token = await resolveRemoteAgentToken(agent.url);
  if (!token) {
    throw new Error(`Failed to resolve auth token for remote agent: ${agentName}`);
  }

  // Create openclaw-gateway conversation via HTTP API.
  // We use httpRequest directly because ipcBridge.conversation.create
  // requires a `model` field that openclaw-gateway doesn't need.
  const conversation = await httpRequest<{ id: string }>('POST', '/api/conversations', {
    type: 'openclaw-gateway',
    name: `${jobName} - ${new Date().toLocaleString()}`,
    extra: {
      workspace: workspace || '',
      custom_workspace: !!workspace,
      cron_job_id: cronJobId,
      cronJobId,
      gateway: {
        host: remoteHost,
        port: Number(remotePort),
        token,
      },
    },
  });

  if (!conversation || !conversation.id) {
    throw new Error('Failed to create remote agent conversation: empty response');
  }

  // Send the cron payload as the initial message
  await httpRequest<unknown>('POST', `/api/conversations/${conversation.id}/messages`, {
    content: payloadText,
  });

  return conversation.id;
}
