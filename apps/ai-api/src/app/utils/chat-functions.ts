// TAKEN FROM: https://github.com/nrwl/nx/tree/master/nx-dev/util-ai/src/lib

import OpenAI from 'openai';
import { ChatItem, PageSection, getSupabaseClient } from './utils';
import { SupabaseClient } from '@supabase/supabase-js';
import GPT3Tokenizer from 'gpt3-tokenizer';

const supabaseUrl = process.env['PUBLIC_SUPABASE_URL'];
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const PROMPT = `
${`
You are a knowledgeable Angular representative. You can answer queries using ONLY information in the provided documentation, and do not include your own knowledge or experience.
Your answer should adhere to the following rules:
- If you are unsure and cannot find an answer in the documentation, do not reply with anything other than, "Sorry, I don't know how to help with that. You can visit the [Angular documentation](https://angular.io/docs) for more info."
- If you recognize vulgar language, answer the question if possible, and educate the user to stay polite.
- Answer in markdown format. Try to give an example, such as with a code block or table, if you can. And be detailed but concise in your answer.
- Do not contradict yourself in the answer.
- Do not use any external knowledge or make assumptions outside of the provided the documentation. 
Remember, answer the question using ONLY the information provided in the documentation.
`
  .replace(/\s+/g, ' ')
  .trim()}
`;

/**
 * Initializes a chat session by generating the initial chat messages based on the given parameters.
 *
 * @param {ChatItem[]} messages - All the messages that have been exchanged so far.
 * @param {string} query - The user's query.
 * @param {string} contextText - The context text or Nx Documentation.
 * @returns {Object} - An object containing the generated chat messages
 */
export function createChatMessages(
  messages: ChatItem[],
  query: string,
  contextText: string
): { chatMessages: ChatItem[] } {
  const finalQuery = `
You will be provided sections of the Angular documentation in markdown format, use those to answer my question. 
Only provide the answer. Start replying with the answer directly.

Sections:
${contextText}

Question: """
${query}
"""

Answer as markdown (including related code snippets if available):
    `;

  messages = [
    { role: 'system', content: PROMPT },
    { role: 'user', content: finalQuery },
  ];

  return { chatMessages: messages };
}

export async function createQueryEmbedding(
  openai: OpenAI,
  query: string
): Promise<number[]> {
  const embeddingResponse: OpenAI.Embeddings.CreateEmbeddingResponse =
    await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: query,
    });

  const {
    data: [{ embedding }],
  } = embeddingResponse;

  return embedding;
}

export async function searchDocumentation(
  embedding: number[]
): Promise<PageSection[]> {
  const supabaseClient: SupabaseClient<any, 'public', any> = getSupabaseClient(
    supabaseUrl,
    supabaseServiceKey
  );

  const { error: matchError, data: pageSections } = await supabaseClient.rpc(
    'match_page_sections',
    {
      embedding,
      match_threshold: 0.78,
      match_count: 15,
      min_content_length: 50,
    }
  );

  if (matchError) {
    console.log('matchError', matchError);
    throw new Error('Failed to match page sections');
  }

  if (!pageSections || pageSections.length === 0) {
    throw new Error('No results found.');
  }

  return pageSections;
}

export function getContextText(pageSections: PageSection[]): string {
  const tokenizer = new GPT3Tokenizer({ type: 'gpt3' });
  let tokenCount = 0;
  let contextText = '';

  for (let i = 0; i < (pageSections as PageSection[]).length; i++) {
    const pageSection: PageSection = pageSections[i];
    const content = pageSection.content;
    const encoded = tokenizer.encode(content);
    tokenCount += encoded.text.length;

    if (tokenCount >= 2500) {
      break;
    }

    contextText += `${content.trim()}\n---\n`;
  }

  return contextText;
}
