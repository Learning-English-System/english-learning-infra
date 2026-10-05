import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 users over 30s
    { duration: '1m', target: 20 },  // Hold at 20 users for 1m
    { duration: '20s', target: 50 }, // Ramp up to 50 users spike
    { duration: '30s', target: 0 },  // Ramp down to 0
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // <1% failure rate
    http_req_duration: ['p(95)<800'], // 95% of requests should be below 800ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://english-learning-gateway:8080';

export default function () {
  // 1. Gateway Health check
  const healthRes = http.get(`${BASE_URL}/healthz`);
  check(healthRes, {
    'healthz status 200': (r) => r.status === 200,
  });

  // 2. High-throughput AI Vocabulary analysis (cached in Redis)
  const words = ['serendipity', 'eloquent', 'ubiquitous', 'resilience', 'ephemeral', 'tenacious'];
  const randomWord = words[Math.floor(Math.random() * words.length)];

  const aiRes = http.post(
    `${BASE_URL}/api/ai/analyze-vocabulary`,
    JSON.stringify({ word: randomWord, contextSentence: `Learning the word ${randomWord} in context.` }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(aiRes, {
    'ai analysis returns 200': (r) => r.status === 200,
    'cached or generated response is fast': (r) => r.timings.duration < 1000,
  });

  sleep(0.5);
}
