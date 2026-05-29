#!/usr/bin/env bun
/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Workaround script for cron jobs with remote OpenClaw agents.
 *
 * AionUI's built-in cron executor uses `type: 'remote'` which fails because
 * the backend cannot establish the WebSocket connection. This script bypasses
 * the broken path by creating `type: 'openclaw-gateway'` conversations directly.
 *
 * Usage:
 *   bun scripts/cron-remote-agent.ts --agent invest-info --message "your prompt"
 *
 * Add to system crontab (e.g. `crontab -e`):
 *   20 6 * * * cd /opt/aionui && bun scripts/cron-remote-agent.ts --agent invest-info --message "$(cat /path/to/prompt.txt)"
 *   0  6 * * * cd /opt/aionui && bun scripts/cron-remote-agent.ts --agent invest-info --message "$(cat /path/to/prompt2.txt)"
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

const API_BASE = process.env.AIONUI_API_URL ?? 'http://127.0.0.1:3000';

/**
 * Well-known remote agent configurations. Map the --agent argument to
 * host/port/token by reading the OpenClaw config files.
 */
function resolveAgentConfig(agentName: string): { host: string; port: number; token: string } | null {
  const home = os.homedir();

  const configPaths: Record<string, string> = {
    'invest-info': path.join(home, '.openclaw-invest-info/openclaw.json'),
    cnshare: path.join(home, '.openclaw-cnshare/openclaw.json'),
    ivi: path.join(home, '.openclaw-ivi/openclaw.json'),
    main: path.join(home, '.openclaw/openclaw.json'),
  };

  const configPath = configPaths[agentName];
  if (!configPath || !fs.existsSync(configPath)) {
    console.error(`Agent config not found: ${configPath ?? agentName}`);
    return null;
  }

  const data = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
    gateway?: { port?: number; auth?: { token?: string } };
  };
  const port = data.gateway?.port ?? 18789;
  const token = data.gateway?.auth?.token;
  if (!token) {
    console.error(`Auth token missing in ${configPath}`);
    return null;
  }
  return { host: '127.0.0.1', port, token };
}

async function api<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as { success: boolean; data?: T; error?: string };
  if (!json.success) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return json.data as T;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const agentIdx = args.indexOf('--agent');
  const messageIdx = args.indexOf('--message');

  if (agentIdx === -1 || messageIdx === -1) {
    console.error('Usage: bun scripts/cron-remote-agent.ts --agent <name> --message <text>');
    console.error('Supported agents: invest-info, cnshare, ivi, main');
    process.exit(1);
  }

  const agentName = args[agentIdx + 1];
  const message = args[messageIdx + 1];

  const gw = resolveAgentConfig(agentName);
  if (!gw) {
    process.exit(1);
  }

  console.log(`[cron-remote-agent] Creating conversation for ${agentName} (${gw.host}:${gw.port})...`);

  const conversation = await api<{ id: string }>('POST', '/api/conversations', {
    type: 'openclaw-gateway',
    name: `cron-${agentName}-${Date.now()}`,
    extra: {
      workspace: '',
      custom_workspace: false,
      gateway: {
        host: gw.host,
        port: gw.port,
        token: gw.token,
      },
    },
  });

  console.log(`[cron-remote-agent] Conversation created: ${conversation.id}`);

  await api('POST', `/api/conversations/${conversation.id}/messages`, {
    content: message,
  });

  console.log(`[cron-remote-agent] Message sent successfully.`);
}

main().catch((err) => {
  console.error('[cron-remote-agent] Failed:', err);
  process.exit(1);
});
