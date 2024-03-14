// Adjusted from: https://github.com/nrwl/nx/blob/master/tools/documentation/create-embeddings/src/main.mts
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import 'openai';
import OpenAI from 'openai';
import { createHash } from 'crypto';
import GithubSlugger from 'github-slugger';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toMarkdown } from 'mdast-util-to-markdown';
import { toString } from 'mdast-util-to-string';
import { u } from 'unist-builder';
import * as dotenv from 'dotenv';
import { readFilePaths } from './utils/file-list.js';

type ProcessedMd = {
  checksum: string;
  sections: Section[];
};

type Section = {
  content: string;
  heading?: string;
  slug?: string;
};

dotenv.config({ path: 'tools/embeddings/.env' });

/**
 * Splits a markdown file into smaller sections.
 */
export function splitTreeBy(tree: any, predicate: (node: any) => boolean) {
  return tree.children.reduce((trees: any, node: any) => {
    const [lastTree] = trees.slice(-1);

    if (!lastTree || predicate(node)) {
      const tree = u('root', [node]);
      return trees.concat(tree);
    }

    lastTree.children.push(node);
    return trees;
  }, []);
}

/**
 * Processes MD content for search indexing.
 * It extracts metadata and splits it into sub-sections based on criteria.
 */
export function processMdxForSearch(content: string): ProcessedMd {
  const checksum = createHash('sha256').update(content).digest('base64');

  const mdTree = fromMarkdown(content, {});

  if (!mdTree) {
    return {
      checksum,
      sections: [],
    };
  }

  const sectionTrees = splitTreeBy(mdTree, (node) => node.type === 'heading');

  const slugger = new GithubSlugger();

  const sections = sectionTrees.map((tree: any) => {
    const [firstNode] = tree.children;

    const heading =
      firstNode.type === 'heading' ? toString(firstNode) : undefined;
    const slug = heading ? slugger.slug(heading) : undefined;

    return {
      content: toMarkdown(tree),
      heading,
      slug,
    };
  });

  return {
    checksum,
    sections,
  };
}

abstract class BaseEmbeddingSource {
  checksum?: string;
  sections?: Section[];

  constructor(public source: string, public path: string) {}

  abstract load(): Promise<{
    checksum: string;
    sections: Section[];
  }>;
}

class MarkdownEmbeddingSource extends BaseEmbeddingSource {
  type = 'markdown' as const;

  constructor(
    source: string,
    public filePath: string,
    public fileContent?: string
  ) {
    const path = filePath.replace(/^docs/, '').replace(/\.md?$/, '');
    super(source, path);
  }

  async load() {
    const contents =
      this.fileContent ?? (await readFile(this.filePath, 'utf8'));

    const { checksum, sections } = processMdxForSearch(contents);

    this.checksum = checksum;
    this.sections = sections;

    return {
      checksum,
      sections,
    };
  }
}

type EmbeddingSource = MarkdownEmbeddingSource;

export async function generateEmbeddings() {
  if (!process.env.PUBLIC_SUPABASE_URL) {
    throw new Error(
      'Environment variable PUBLIC_SUPABASE_URL is required: skipping embeddings generation'
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Environment variable SUPABASE_SERVICE_ROLE_KEY is required: skipping embeddings generation'
    );
  }

  if (!process.env.OPENAI_KEY) {
    throw new Error(
      'Environment variable OPENAI_KEY is required: skipping embeddings generation'
    );
  }

  if (!process.env.DOCS_PATH) {
    throw new Error(
      'Environment variable DOCS_PATH is required: skipping embeddings generation'
    );
  }

  const supabaseClient = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const allFilePaths = await readFilePaths(process.env.DOCS_PATH);

  const embeddingSources: EmbeddingSource[] = [
    ...allFilePaths.map((entry) => {
      return new MarkdownEmbeddingSource('guide', entry);
    }),
  ];

  console.log(`Discovered ${embeddingSources.length} pages`);
  console.log('Checking which pages are new or have changed');

  for (const [index, embeddingSource] of embeddingSources.entries()) {
    const { type, source, path } = embeddingSource;

    try {
      const { checksum, sections } = await embeddingSource.load();

      // Check for existing page in DB and compare checksums
      const { error: fetchPageError, data: existingPage } = await supabaseClient
        .from('nods_page')
        .select('id, path, checksum')
        .filter('path', 'eq', path)
        .limit(1)
        .maybeSingle();

      if (fetchPageError) {
        console.error(fetchPageError);
      }

      // We use checksum to determine if this page & its sections need to be regenerated
      if (existingPage?.checksum === checksum) {
        continue;
      }

      if (existingPage) {
        console.log(
          `#${index}: [${path}] Docs have changed, removing old page sections and their embeddings`
        );

        const { error: deletePageSectionError } = await supabaseClient
          .from('nods_page_section')
          .delete()
          .filter('page_id', 'eq', existingPage.id);

        if (deletePageSectionError) {
          throw deletePageSectionError;
        }
      }

      // Create/update page record. Intentionally clear checksum until we
      // have successfully generated all page sections.
      const { error: upsertPageError, data: page } = await supabaseClient
        .from('nods_page')
        .upsert(
          {
            checksum: null,
            path,
            type,
            source,
          },
          { onConflict: 'path' }
        )
        .select()
        .limit(1)
        .single();

      if (upsertPageError) {
        throw upsertPageError;
      }

      console.log(
        `#${index}: [${path}] Adding ${sections.length} page sections (with embeddings)`
      );
      console.log(
        `${embeddingSources.length - index - 1} pages remaining to process.`
      );

      for (const { slug, heading, content } of sections) {
        // OpenAI recommends replacing newlines with spaces for best results (specific to embeddings)
        const input = content.replace(/\n/g, ' ');

        try {
          const openai = new OpenAI({
            apiKey: process.env.OPENAI_KEY,
          });
          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input,
          });

          const [responseData] = embeddingResponse.data;

          const { error: insertPageSectionError } = await supabaseClient
            .from('nods_page_section')
            .insert({
              page_id: page.id,
              slug,
              heading,

              content,

              token_count: embeddingResponse.usage.total_tokens,
              embedding: responseData.embedding,
            })
            .select()
            .limit(1)
            .single();

          if (insertPageSectionError) {
            throw insertPageSectionError;
          }
          // Add delay after each request
          await delay(500);
        } catch (err) {
          console.error(
            `Failed to generate embeddings for '${path}' page section starting with '${input.slice(
              0,
              40
            )}...'`
          );

          throw err;
        }
      }

      // Set page checksum so that we know this page was stored successfully
      const { error: updatePageError } = await supabaseClient
        .from('nods_page')
        .update({ checksum })
        .filter('id', 'eq', page.id);

      if (updatePageError) {
        throw updatePageError;
      }
    } catch (err) {
      console.error(
        `Page '${path}' or one/multiple of its page sections failed to store properly. Page has been marked with null checksum to indicate that it needs to be re-generated.`
      );
      console.error(err);
    }
  }

  console.log('Embedding generation complete');
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
