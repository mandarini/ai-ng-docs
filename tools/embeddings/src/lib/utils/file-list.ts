import { promises as fs } from 'fs';
import { resolve, join } from 'path';

export async function readFilePaths(directoryPath) {
  const filePaths = [];

  async function readDirectory(directory) {
    const resolvedDirectoryPath = resolve(directory);
    const entries = await fs.readdir(resolvedDirectoryPath, {
      withFileTypes: true,
    });

    for (const dirent of entries) {
      const entryPath = join(resolvedDirectoryPath, dirent.name);
      if (dirent.isDirectory()) {
        await readDirectory(entryPath);
      } else {
        filePaths.push(entryPath);
      }
    }
  }

  try {
    await readDirectory(directoryPath);
    return filePaths;
  } catch (error) {
    console.error('Error reading directory recursively:', error);
    return [];
  }
}
