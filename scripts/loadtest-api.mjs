#!/usr/bin/env node

import { performance } from 'node:perf_hooks';

const DEFAULTS = {
  url: 'http://127.0.0.1:3001/healthz',
  method: 'GET',
  durationSec: 60,
  concurrency: 20,
  timeoutMs: 8000,
  headers: {},
  body: null,
};

const parseArgs = (argv) => {
  const options = { ...DEFAULTS };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--url' && next) {
      options.url = next;
      index += 1;
      continue;
    }
    if (arg === '--method' && next) {
      options.method = next.toUpperCase();
      index += 1;
      continue;
    }
    if (arg === '--duration' && next) {
      options.durationSec = Math.max(1, Number.parseInt(next, 10) || DEFAULTS.durationSec);
      index += 1;
      continue;
    }
    if (arg === '--concurrency' && next) {
      options.concurrency = Math.max(1, Number.parseInt(next, 10) || DEFAULTS.concurrency);
      index += 1;
      continue;
    }
    if (arg === '--timeout' && next) {
      options.timeoutMs = Math.max(500, Number.parseInt(next, 10) || DEFAULTS.timeoutMs);
      index += 1;
      continue;
    }
    if (arg === '--header' && next) {
      const separatorIndex = next.indexOf(':');
      if (separatorIndex > 0) {
        const key = next.slice(0, separatorIndex).trim();
        const value = next.slice(separatorIndex + 1).trim();
        if (key && value) {
          options.headers[key] = value;
        }
      }
      index += 1;
      continue;
    }
    if (arg === '--body' && next) {
      options.body = next;
      index += 1;
      continue;
    }
    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
};

const printHelp = () => {
  console.log(`Usage:
  node scripts/loadtest-api.mjs [options]

Options:
  --url <url>             Target URL (default: ${DEFAULTS.url})
  --method <verb>         HTTP method (default: ${DEFAULTS.method})
  --duration <seconds>    Test duration in seconds (default: ${DEFAULTS.durationSec})
  --concurrency <n>       Number of concurrent workers (default: ${DEFAULTS.concurrency})
  --timeout <ms>          Per-request timeout in ms (default: ${DEFAULTS.timeoutMs})
  --header "K: V"         Extra header (can be repeated)
  --body "<json>"         Request body (for POST/PATCH/PUT)
  --help                  Show this help

Examples:
  node scripts/loadtest-api.mjs --url http://127.0.0.1:3001/healthz --duration 120 --concurrency 50
  node scripts/loadtest-api.mjs --url http://127.0.0.1:3001/v1/analytics/events --method POST \\
    --header "content-type: application/json" \\
    --body '{"eventName":"app_page_view","target":"navigation","sessionId":"loadtest-session-123","path":"/","source":"web","properties":{}}'
`);
};

const percentile = (sortedValues, fraction) => {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * fraction) - 1),
  );
  return sortedValues[index];
};

const run = async () => {
  const options = parseArgs(process.argv);
  const startedAt = Date.now();
  const endsAt = startedAt + options.durationSec * 1000;

  const results = {
    total: 0,
    ok2xx: 0,
    status4xx: 0,
    status5xx: 0,
    networkErrors: 0,
    timeouts: 0,
    latenciesMs: [],
  };

  const worker = async () => {
    while (Date.now() < endsAt) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
      const requestStarted = performance.now();

      try {
        const response = await fetch(options.url, {
          method: options.method,
          headers: options.headers,
          body: options.body,
          signal: controller.signal,
        });
        const latency = performance.now() - requestStarted;

        results.total += 1;
        results.latenciesMs.push(latency);

        if (response.status >= 200 && response.status < 300) {
          results.ok2xx += 1;
        } else if (response.status >= 400 && response.status < 500) {
          results.status4xx += 1;
        } else if (response.status >= 500) {
          results.status5xx += 1;
        }
      } catch (error) {
        const latency = performance.now() - requestStarted;
        results.total += 1;
        results.latenciesMs.push(latency);

        if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
          results.timeouts += 1;
        } else {
          results.networkErrors += 1;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }
  };

  console.log('[loadtest] starting', {
    url: options.url,
    method: options.method,
    durationSec: options.durationSec,
    concurrency: options.concurrency,
    timeoutMs: options.timeoutMs,
  });

  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));

  const totalDurationSec = (Date.now() - startedAt) / 1000;
  const sortedLatencies = [...results.latenciesMs].sort((left, right) => left - right);
  const requestsPerSecond = totalDurationSec > 0 ? results.total / totalDurationSec : 0;
  const successRate = results.total > 0 ? (results.ok2xx / results.total) * 100 : 0;

  console.log('\n[loadtest] summary');
  console.log(`- Total requests: ${results.total}`);
  console.log(`- 2xx: ${results.ok2xx}`);
  console.log(`- 4xx: ${results.status4xx}`);
  console.log(`- 5xx: ${results.status5xx}`);
  console.log(`- Timeouts: ${results.timeouts}`);
  console.log(`- Network errors: ${results.networkErrors}`);
  console.log(`- Duration (s): ${totalDurationSec.toFixed(2)}`);
  console.log(`- Throughput (req/s): ${requestsPerSecond.toFixed(2)}`);
  console.log(`- Success rate (%): ${successRate.toFixed(2)}`);
  console.log(`- Latency p50 (ms): ${percentile(sortedLatencies, 0.5).toFixed(2)}`);
  console.log(`- Latency p95 (ms): ${percentile(sortedLatencies, 0.95).toFixed(2)}`);
  console.log(`- Latency p99 (ms): ${percentile(sortedLatencies, 0.99).toFixed(2)}`);

  if (results.status5xx > 0 || results.timeouts > 0 || successRate < 99) {
    process.exitCode = 2;
  }
};

void run();
