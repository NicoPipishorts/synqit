/**
 * Loads `.env.local` then `.env` from the working directory.
 *
 * This module has side effects only and must be the first import of the API
 * entrypoint so every other module sees the populated `process.env`.
 */
import { resolve } from 'node:path';

const loadEnvFileIfPresent = (filePath: string): void => {
  try {
    process.loadEnvFile(filePath);
  } catch (error) {
    const normalizedError = error as { code?: string } | undefined;
    if (normalizedError?.code !== 'ENOENT') {
      throw error;
    }
  }
};

// .env.local takes precedence when both files exist.
loadEnvFileIfPresent(resolve(process.cwd(), '.env.local'));
loadEnvFileIfPresent(resolve(process.cwd(), '.env'));
