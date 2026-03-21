import readline from 'node:readline';

const POLL_PREFIX = '[poll] ';
const POLL_PATTERNS = [
  '"msg":"[api][poll]',
  '"msg":"[poll]',
  '"msg":"automatic sync ',
  '"msg":"[api][poll] ',
];

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on('line', (line) => {
  const isPollLine = POLL_PATTERNS.some((pattern) => line.includes(pattern));
  process.stdout.write(`${isPollLine ? POLL_PREFIX : ''}${line}\n`);
});

rl.on('close', () => {
  process.stdout.end();
});
