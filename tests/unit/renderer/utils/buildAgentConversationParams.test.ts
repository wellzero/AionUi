import { describe, expect, it } from 'vitest';

import {
  buildAgentConversationParams,
  getConversationTypeForBackend,
} from '@/common/utils/buildAgentConversationParams';

const model = {
  provider: 'openai',
  use_model: 'gpt-4.1',
  model: 'gpt-4.1',
};

describe('buildAgentConversationParams agent type policy', () => {
  it('maps only aionrs to top-level aionrs', () => {
    expect(getConversationTypeForBackend('aionrs')).toBe('aionrs');
  });

  it('maps ACP vendors and deprecated runtime labels to acp', () => {
    for (const backend of ['claude', 'codex', 'gemini', 'openclaw', 'nanobot']) {
      expect(getConversationTypeForBackend(backend)).toBe('acp');
    }
  });

  it('maps remote and openclaw-gateway backends to their own conversation types', () => {
    expect(getConversationTypeForBackend('remote')).toBe('remote');
    expect(getConversationTypeForBackend('openclaw-gateway')).toBe('openclaw-gateway');
  });

  it('builds OpenClaw as an ACP backend instead of openclaw-gateway', () => {
    const params = buildAgentConversationParams({
      backend: 'openclaw',
      name: 'OpenClaw',
      workspace: '/tmp/aionui-openclaw',
      model,
    });

    expect(params.type).toBe('acp');
    expect(params.extra.backend).toBe('openclaw');
    expect(params.extra.agent_name).toBe('OpenClaw');
    expect(params.extra.gateway).toBeUndefined();
  });

  it('creates Codex conversations as ACP backend conversations', () => {
    const params = buildAgentConversationParams({
      backend: 'codex',
      name: 'Codex CLI',
      agent_name: 'Codex CLI',
      workspace: '/tmp/aionui-codex',
      model,
    });

    expect(params.type).toBe('acp');
    expect(params.extra.backend).toBe('codex');
  });

  it('builds remote conversations with remote_agent_id', () => {
    const params = buildAgentConversationParams({
      backend: 'remote',
      name: 'Remote Agent',
      custom_agent_id: 'remote-agent-1',
      workspace: '/tmp/aionui-remote',
      model,
    });

    expect(params.type).toBe('remote');
    expect(params.extra.remote_agent_id).toBe('remote-agent-1');
    expect(params.extra.remoteAgentId).toBe('remote-agent-1');
  });

  it('builds openclaw-gateway conversations with gateway config', () => {
    const params = buildAgentConversationParams({
      backend: 'openclaw-gateway',
      name: 'OpenClaw Gateway',
      agent_name: 'OpenClaw Gateway',
      custom_agent_id: 'gateway-agent-1',
      cli_path: '/usr/bin/openclaw',
      workspace: '/tmp/aionui-gateway',
      model,
    });

    expect(params.type).toBe('openclaw-gateway');
    expect(params.extra.agent_name).toBe('OpenClaw Gateway');
    expect(params.extra.custom_agent_id).toBe('gateway-agent-1');
    expect(params.extra.gateway).toEqual({ cli_path: '/usr/bin/openclaw' });
  });
});
