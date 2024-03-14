import { Injectable } from '@nestjs/common';
import {
  CustomError,
  PageSection,
  getOpenAI,
  getSupabaseClient,
} from './utils/utils';
import { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import {
  DEFAULT_MATCH_COUNT,
  DEFAULT_MATCH_THRESHOLD,
  MIN_CONTENT_LENGTH,
  PROMPT,
} from './utils/constants';
import GPT3Tokenizer from 'gpt3-tokenizer';
import { initializeChat } from './utils/chat-utils';

const supabaseUrl = process.env['PUBLIC_SUPABASE_URL'];
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const openAiKey = process.env['OPENAI_KEY'];

@Injectable()
export class AppService {
  async processQuery(query: string): Promise<string> {
    const openai = getOpenAI(openAiKey);
    const supabaseClient: SupabaseClient<any, 'public', any> =
      getSupabaseClient(supabaseUrl, supabaseServiceKey);

    const embeddingResponse: OpenAI.Embeddings.CreateEmbeddingResponse =
      await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: query,
      });

    const {
      data: [{ embedding }],
    } = embeddingResponse;

    const { error: matchError, data: pageSections } = await supabaseClient.rpc(
      'match_page_sections',
      {
        embedding,
        match_threshold: DEFAULT_MATCH_THRESHOLD,
        match_count: DEFAULT_MATCH_COUNT,
        min_content_length: MIN_CONTENT_LENGTH,
      }
    );

    if (matchError) {
      console.log('matchError', matchError);
      throw new CustomError(
        'application_error',
        'Failed to match page sections',
        matchError
      );
    }

    if (!pageSections || pageSections.length === 0) {
      throw new CustomError('user_error', 'No results found.', {
        no_results: true,
      });
    }

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

    const { chatMessages } = initializeChat([], query, contextText, PROMPT);

    const response: OpenAI.Chat.Completions.ChatCompletion =
      await openai.chat.completions.create({
        model: 'gpt-3.5-turbo-16k',
        messages:
          chatMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature: 0,
        stream: false,
      });

    const responseText = response?.choices?.[0]?.message?.content;

    return responseText;
  }
}
