import { Injectable } from '@nestjs/common';
import { getOpenAI } from './utils/utils';
import OpenAI from 'openai';
import {
  createQueryEmbedding,
  getContextText,
  createChatMessages,
  searchDocumentation,
} from './utils/chat-functions';

const openAiKey = process.env['OPENAI_KEY'];

@Injectable()
export class AppService {
  async processQuery(query: string): Promise<string> {
    const openai = getOpenAI(openAiKey);

    const embedding = await createQueryEmbedding(openai, query);

    const pageSections = await searchDocumentation(embedding);

    const contextText = getContextText(pageSections);

    const { chatMessages } = createChatMessages([], query, contextText);

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
