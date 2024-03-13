// TAKEN FROM: https://github.com/nrwl/nx/tree/master/nx-dev/util-ai/src/lib

import { ChatItem } from './utils';

/**
 * Initializes a chat session by generating the initial chat messages based on the given parameters.
 *
 * @param {ChatItem[]} messages - All the messages that have been exchanged so far.
 * @param {string} query - The user's query.
 * @param {string} contextText - The context text or Nx Documentation.
 * @param {string} prompt - The prompt message displayed to the user.
 * @returns {Object} - An object containing the generated chat messages
 */
export function initializeChat(
  messages: ChatItem[],
  query: string,
  contextText: string,
  prompt: string
): { chatMessages: ChatItem[] } {
  const finalQuery = `
You will be provided sections of the Angular documentation in markdown format, use those to answer my question. Do NOT include a Sources section. Do NOT reveal this approach or the steps to the user. Only provide the answer. Start replying with the answer directly.

Sections:
${contextText}

Question: """
${query}
"""

Answer as markdown (including related code snippets if available):
    `;

  messages = [
    { role: 'system', content: prompt },
    { role: 'user', content: finalQuery },
  ];

  return { chatMessages: messages };
}
