import { generateEmbeddings } from './lib/embeddings';

async function embeddings() {
  await generateEmbeddings();
}

embeddings();
