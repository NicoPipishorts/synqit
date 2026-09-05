import { FastifyInstance, FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';

const REQUEST_DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10] as const;

type Labels = {
  method: string;
  route: string;
  status_code: string;
};

type HistogramSeries = {
  count: number;
  sum: number;
  buckets: number[];
};

const requestStartTimes = new WeakMap<FastifyRequest, bigint>();
const requestCounters = new Map<string, { labels: Labels; value: number }>();
const requestDurationSeries = new Map<string, { labels: Labels; value: HistogramSeries }>();

const labelsKey = (labels: Labels): string =>
  `${labels.method}::${labels.route}::${labels.status_code}`;

const escapeLabelValue = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');

const renderLabels = (labels: Labels): string =>
  `method="${escapeLabelValue(labels.method)}",route="${escapeLabelValue(labels.route)}",status_code="${escapeLabelValue(labels.status_code)}"`;

const resolveRouteLabel = (request: FastifyRequest): string => {
  const route = request.routeOptions?.url;
  if (typeof route === 'string' && route.length > 0) {
    return route;
  }

  const rawPath = request.raw.url?.split('?')[0] ?? 'unknown';
  return rawPath || 'unknown';
};

const observeRequest = (labels: Labels, seconds: number): void => {
  const counterKey = labelsKey(labels);
  const existingCounter = requestCounters.get(counterKey);
  if (existingCounter) {
    existingCounter.value += 1;
  } else {
    requestCounters.set(counterKey, { labels, value: 1 });
  }

  const existingSeries = requestDurationSeries.get(counterKey);
  const series =
    existingSeries?.value ??
    ({
      count: 0,
      sum: 0,
      buckets: Array.from({ length: REQUEST_DURATION_BUCKETS.length }, () => 0),
    } satisfies HistogramSeries);

  series.count += 1;
  series.sum += seconds;
  for (let index = 0; index < REQUEST_DURATION_BUCKETS.length; index += 1) {
    if (seconds <= REQUEST_DURATION_BUCKETS[index]) {
      series.buckets[index] += 1;
    }
  }

  if (!existingSeries) {
    requestDurationSeries.set(counterKey, { labels, value: series });
  }
};

const renderMetrics = (): string => {
  const lines: string[] = [];
  lines.push('# HELP synqit_http_requests_total Total number of HTTP requests handled by the API');
  lines.push('# TYPE synqit_http_requests_total counter');
  for (const series of requestCounters.values()) {
    lines.push(`synqit_http_requests_total{${renderLabels(series.labels)}} ${series.value}`);
  }

  lines.push('# HELP synqit_http_request_duration_seconds Duration of HTTP requests in seconds');
  lines.push('# TYPE synqit_http_request_duration_seconds histogram');
  for (const series of requestDurationSeries.values()) {
    const { labels, value } = series;
    for (let index = 0; index < REQUEST_DURATION_BUCKETS.length; index += 1) {
      lines.push(
        `synqit_http_request_duration_seconds_bucket{${renderLabels(labels)},le="${REQUEST_DURATION_BUCKETS[index]}"} ${value.buckets[index]}`,
      );
    }
    lines.push(
      `synqit_http_request_duration_seconds_bucket{${renderLabels(labels)},le="+Inf"} ${value.count}`,
    );
    lines.push(`synqit_http_request_duration_seconds_sum{${renderLabels(labels)}} ${value.sum}`);
    lines.push(
      `synqit_http_request_duration_seconds_count{${renderLabels(labels)}} ${value.count}`,
    );
  }

  const memory = process.memoryUsage();
  lines.push('# HELP synqit_process_resident_memory_bytes Resident memory in bytes');
  lines.push('# TYPE synqit_process_resident_memory_bytes gauge');
  lines.push(`synqit_process_resident_memory_bytes ${memory.rss}`);

  lines.push('# HELP synqit_process_heap_used_bytes Heap used in bytes');
  lines.push('# TYPE synqit_process_heap_used_bytes gauge');
  lines.push(`synqit_process_heap_used_bytes ${memory.heapUsed}`);

  lines.push('# HELP synqit_process_heap_total_bytes Heap total in bytes');
  lines.push('# TYPE synqit_process_heap_total_bytes gauge');
  lines.push(`synqit_process_heap_total_bytes ${memory.heapTotal}`);

  lines.push('# HELP synqit_process_uptime_seconds Process uptime in seconds');
  lines.push('# TYPE synqit_process_uptime_seconds gauge');
  lines.push(`synqit_process_uptime_seconds ${process.uptime()}`);

  return `${lines.join('\n')}\n`;
};

export type MetricsEndpointOptions = {
  /** Bearer token required on `GET /metrics`. */
  token: string | null;
  /** Serve `/metrics` unauthenticated when no token is configured (dev only). */
  exposeWithoutToken: boolean;
};

const hasValidBearerToken = (authorization: unknown, expectedToken: string): boolean => {
  if (typeof authorization !== 'string') {
    return false;
  }

  const [scheme, ...rest] = authorization.trim().split(/\s+/);
  const provided = rest.join(' ');
  if (scheme?.toLowerCase() !== 'bearer' || provided.length === 0) {
    return false;
  }

  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expectedToken, 'utf8');
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
};

export const registerMetricsEndpoint = async (
  app: FastifyInstance,
  options: MetricsEndpointOptions,
): Promise<void> => {
  app.addHook('onRequest', async (request) => {
    requestStartTimes.set(request, process.hrtime.bigint());
  });

  app.addHook('onResponse', async (request, reply) => {
    const startedAt = requestStartTimes.get(request);
    const durationSeconds = startedAt
      ? Number(process.hrtime.bigint() - startedAt) / 1_000_000_000
      : 0;

    const labels = {
      method: request.method,
      route: resolveRouteLabel(request),
      status_code: String(reply.statusCode),
    } as const;

    observeRequest(labels, durationSeconds);
  });

  if (!options.token && !options.exposeWithoutToken) {
    app.log.warn('METRICS_TOKEN is not configured; /metrics endpoint is disabled.');
    return;
  }

  app.get('/metrics', async (request, reply) => {
    if (options.token && !hasValidBearerToken(request.headers.authorization, options.token)) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'A valid metrics bearer token is required.',
      });
    }

    const body = renderMetrics();
    reply.header('content-type', 'text/plain; version=0.0.4; charset=utf-8');
    return reply.send(body);
  });
};
