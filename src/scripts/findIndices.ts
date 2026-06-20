import fs from 'fs';
import path from 'path';

const fileContent = fs.readFileSync(path.join(__dirname, '../cron/dailyDictionaryExpander.ts'), 'utf8');

// Just parse it by finding the start of array and end of array
const startIndex = fileContent.indexOf('const MASTER_WORD_LIST: string[] = [');
const endIndex = fileContent.indexOf('];', startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  let rawList = fileContent.substring(startIndex + 'const MASTER_WORD_LIST: string[] = ['.length, endIndex);
  // Remove all single line comments
  rawList = rawList.replace(/\/\/.*$/gm, '');
  const words = rawList.split(',').map(w => w.replace(/['"\s]/g, '')).filter(Boolean);
  
  const findIndex = (word: string, fromIndex = 0) => words.indexOf(word, fromIndex);
  
  console.log('Total words:', words.length);
  console.log("Index of 'able':", findIndex('able'));
  console.log("Index of 'young':", findIndex('young'));
  console.log("Index of 'abandon':", findIndex('abandon'));
  console.log("Index of 'methodical':", findIndex('methodical'));
  console.log("Index of 'aberrant':", findIndex('aberrant'));
  console.log("Index of 'depravity':", findIndex('depravity'));
  console.log("Index of 'abeyance':", findIndex('abeyance'));
  console.log("Index of 'zenith':", findIndex('zenith'));
} else {
  console.log('Failed to parse MASTER_WORD_LIST');
}
