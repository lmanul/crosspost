import { readFile } from 'fs/promises';

const parseConfig = async (fileName) => {
  const parsed = {};

  const content = await readFile(fileName, 'utf-8');
  const lines = content.split('\n');

  for (let line of lines) {
    line = line.trim()
    if (!line) {
      continue;
    }
    const parts = line.split(':', 3);
    const serviceName = parts[0];
    parsed[serviceName] = [parts[1], parts[2]];
    if (serviceName === 'instagram') {
      // Instagram and Threads share login info
      parsed['threads'] = [parts[1], parts[2]];
    }
  }

  return parsed;
};

export default parseConfig;
