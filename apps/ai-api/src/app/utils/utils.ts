// TAKEN FROM: https://github.com/nrwl/nx/tree/master/nx-dev/util-ai/src/lib

import OpenAI from 'openai';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

let openai: OpenAI;
let supabaseClient: SupabaseClient<any, 'public', any>;

export function getOpenAI(openAiKey?: string): OpenAI {
  if (openai) return openai;
  if (!openAiKey) {
    throw new Error('Missing environment variable NX_OPENAI_KEY');
  }
  openai = new OpenAI({ apiKey: openAiKey });
  return openai;
}

export function getSupabaseClient(
  supabaseUrl?: string,
  supabaseServiceKey?: string
): SupabaseClient<any, 'public', any> {
  if (supabaseClient) return supabaseClient;
  if (!supabaseUrl) {
    throw new Error('Missing environment variable NX_PUBLIC_SUPABASE_URL');
  }
  if (!supabaseServiceKey) {
    throw new Error(
      'Missing environment variable NX_SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  supabaseClient = createClient(
    supabaseUrl as string,
    supabaseServiceKey as string
  );
  return supabaseClient;
}

export interface PageSection {
  id: number;
  page_id: number;
  content: string;
  heading: string;
  longer_heading: string;
  similarity: number;
  slug: string;
  url_partial: string | null;
}

export interface ChatItem {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
}
