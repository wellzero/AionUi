/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Format the current date as a compact locale-aware string (e.g. "Jun 2").
 */
function formatConversationDate(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Build a default conversation name that includes today's date so multiple
 * untitled sessions are distinguishable in the sidebar.
 */
export function buildDefaultConversationName(baseName: string): string {
  const dateStr = formatConversationDate();
  return `${baseName} · ${dateStr}`;
}

/**
 * Force new-session entry points to start from the localized default title.
 */
export function applyDefaultConversationName<T extends object>(
  conversation: T,
  defaultName: string
): Omit<T, 'name'> & { name: string } {
  return {
    ...conversation,
    name: buildDefaultConversationName(defaultName),
  };
}
