/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';

let tokenCache: Record<string, string> | null = null;
let tokenCachePromise: Promise<Record<string, string>> | null = null;

/**
 * Derive the home directory from the backend workDir.
 */
function deriveHomeFromWorkDir(workDir: string): string {
  const suffixes = [
    '/.aionui-server/aionui',
    '/.aionui-web/aionui',
    '/.aionui-web-dev/aionui',
    '/.config/AionUi/aionui',
    '/Library/Application Support/AionUi/aionui',
  ];
  for (const suffix of suffixes) {
    if (workDir.endsWith(suffix)) {
      return workDir.slice(0, -suffix.length);
    }
  }
  // Fallback: remove last two segments
  const parts = workDir.split('/');
  return parts.slice(0, -2).join('/') || '/';
}

/**
 * Read an OpenClaw config file and extract the gateway port + token.
 */
async function readOpenClawConfig(path: string): Promise<{ port: number; token: string } | null> {
  try {
    const content = await ipcBridge.fs.readFile.invoke({ path });
    if (!content) return null;
    const data = JSON.parse(content) as {
      gateway?: { port?: number; auth?: { token?: string } };
    };
    const port = data.gateway?.port;
    const token = data.gateway?.auth?.token;
    if (port && token) {
      return { port, token };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build a port -> token mapping by scanning well-known OpenClaw config dirs.
 */
async function buildTokenMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

  // Try webui static file first (fast path for webui)
  try {
    const res = await fetch('/remote-agent-tokens.json');
    if (res.ok) {
      const data = (await res.json()) as { tokens?: Record<string, string> };
      if (data.tokens) {
        return data.tokens;
      }
    }
  } catch {
    // ignore - fall through to fs.readFile approach
  }

  // Derive home from backend workDir
  let home = '/';
  try {
    const sysInfo = await ipcBridge.application.systemInfo.invoke();
    home = deriveHomeFromWorkDir(sysInfo.workDir);
  } catch {
    // fallback to root
  }

  // Well-known config paths
  const configPaths = [
    `${home}/.openclaw/openclaw.json`,
    `${home}/.openclaw-cnshare/openclaw.json`,
    `${home}/.openclaw-invest-info/openclaw.json`,
    `${home}/.openclaw-ivi/openclaw.json`,
  ];

  for (const path of configPaths) {
    const cfg = await readOpenClawConfig(path);
    if (cfg) {
      map[String(cfg.port)] = cfg.token;
    }
  }

  return map;
}

/**
 * Resolve the OpenClaw auth token for a remote agent given its WebSocket URL.
 * Results are cached for the session.
 */
export async function resolveRemoteAgentToken(url: string): Promise<string | null> {
  if (!tokenCachePromise) {
    tokenCachePromise = buildTokenMap();
  }
  tokenCache = await tokenCachePromise;

  try {
    const parsed = new URL(url);
    const port = parsed.port || (parsed.protocol === 'wss:' ? '443' : '80');
    return tokenCache[port] ?? null;
  } catch {
    return null;
  }
}
