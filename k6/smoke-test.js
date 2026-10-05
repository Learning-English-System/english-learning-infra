import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate>0.95'],
    http_req_duration: ['p(95)<2000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://english-learning-gateway:8080';

export default function () {
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const testEmail = `smoke_user_${timestamp}_${randomSuffix}@example.com`;
  const testPassword = 'P@ssword123!Secure';
  const testFullName = `Smoke Learner ${randomSuffix}`;

  let accessToken = '';
  let categoryId = '';
  let vocabId = '';
  let testId = '';

  group('01. Gateway Health', () => {
    const res = http.get(`${BASE_URL}/healthz`);
    check(res, {
      'gateway health status is 200': (r) => r.status === 200,
      'gateway service healthy': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status === 'Healthy';
        } catch {
          return false;
        }
      },
    });
  });

  group('02. Authentication & Authorization', () => {
    // Register
    const registerPayload = JSON.stringify({
      email: testEmail,
      password: testPassword,
      fullName: testFullName,
    });
    const regRes = http.post(`${BASE_URL}/api/auth/register`, registerPayload, {
      headers: { 'Content-Type': 'application/json' },
    });
    check(regRes, {
      'register status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    });

    // Login
    const loginPayload = JSON.stringify({
      email: testEmail,
      password: testPassword,
      deviceInfo: 'k6-smoke-runner-linux',
      ipAddress: '127.0.0.1',
    });
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
      headers: { 'Content-Type': 'application/json' },
    });
    check(loginRes, {
      'login status is 200': (r) => r.status === 200,
      'access token received': (r) => {
        try {
          const body = JSON.parse(r.body);
          accessToken = body.accessToken;
          return !!accessToken;
        } catch {
          return false;
        }
      },
    });
  });

  if (!accessToken) {
    console.error('Cannot proceed without access token');
    return;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  group('03. Profile Service', () => {
    const profRes = http.get(`${BASE_URL}/api/profile/me`, { headers: authHeaders });
    check(profRes, {
      'profile fetch status is 200': (r) => r.status === 200,
    });

    const updateProfilePayload = JSON.stringify({
      fullName: `${testFullName} (Updated)`,
      targetLanguage: 'English',
      dailyGoalMinutes: 30,
      proficiencyLevel: 'B2',
    });
    const updateRes = http.put(`${BASE_URL}/api/profile/me`, updateProfilePayload, {
      headers: authHeaders,
    });
    check(updateRes, {
      'profile update status is 200': (r) => r.status === 200,
    });
  });

  group('04. Vocabulary & Spaced Repetition (Learning Service)', () => {
    // Categories
    const catRes = http.get(`${BASE_URL}/api/vocabulary/categories`, { headers: authHeaders });
    check(catRes, {
      'categories fetched': (r) => {
        try {
          const body = JSON.parse(r.body);
          if (Array.isArray(body) && body.length > 0) {
            categoryId = body[0].id;
          }
          return r.status === 200;
        } catch {
          return false;
        }
      },
    });

    // Create vocabulary item
    const addVocabPayload = JSON.stringify({
      word: `perseverance_${randomSuffix}`,
      phonetic: '/ˌpɜːsɪˈvɪərəns/',
      partOfSpeech: 'noun',
      definition: 'Persistence in doing something despite difficulty or delay in achieving success.',
      exampleSentence: 'Success usually requires great perseverance and dedication.',
      categoryId: categoryId || null,
    });
    const addVocabRes = http.post(`${BASE_URL}/api/vocabulary`, addVocabPayload, {
      headers: authHeaders,
    });
    check(addVocabRes, {
      'add vocabulary status is 200 or 201': (r) => {
        try {
          const body = JSON.parse(r.body);
          vocabId = body.id;
          return r.status === 200 || r.status === 201;
        } catch {
          return false;
        }
      },
    });

    // List due reviews
    const dueRes = http.get(`${BASE_URL}/api/vocabulary/reviews/due`, { headers: authHeaders });
    check(dueRes, {
      'due reviews queue status is 200': (r) => r.status === 200,
    });

    // Submit SM-2 review rating if item exists
    if (vocabId) {
      const reviewPayload = JSON.stringify({
        quality: 4, // "Good"
      });
      const reviewRes = http.post(`${BASE_URL}/api/vocabulary/${vocabId}/reviews`, reviewPayload, {
        headers: authHeaders,
      });
      check(reviewRes, {
        'submit review status is 200': (r) => r.status === 200,
      });
    }
  });

  group('05. AI Service Analysis & Distractors', () => {
    // Vocabulary analysis
    const aiAnalysisPayload = JSON.stringify({
      word: 'resilient',
      contextSentence: 'She has a resilient attitude towards life challenges.',
    });
    const aiRes = http.post(`${BASE_URL}/api/ai/analyze-vocabulary`, aiAnalysisPayload, {
      headers: authHeaders,
    });
    check(aiRes, {
      'ai vocabulary analysis status is 200': (r) => r.status === 200,
      'ai returns CEFR and phonetic': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!body.cefrLevel && !!body.phonetic;
        } catch {
          return false;
        }
      },
    });

    // Distractor generator
    const distractorPayload = JSON.stringify({
      targetWord: 'resilient',
      count: 3,
    });
    const distractorRes = http.post(`${BASE_URL}/api/ai/distractors`, distractorPayload, {
      headers: authHeaders,
    });
    check(distractorRes, {
      'distractor generator status is 200': (r) => r.status === 200,
      'distractors received': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.distractors) && body.distractors.length > 0;
        } catch {
          return false;
        }
      },
    });
  });

  group('06. Test Service Quizzes & Scoring', () => {
    // Generate test
    const testGenPayload = JSON.stringify({
      questionCount: 3,
      categoryId: categoryId || null,
    });
    const testGenRes = http.post(`${BASE_URL}/api/tests/generate`, testGenPayload, {
      headers: authHeaders,
    });
    check(testGenRes, {
      'test generated status is 200 or 201': (r) => {
        try {
          const body = JSON.parse(r.body);
          testId = body.id;
          return (r.status === 200 || r.status === 201) && Array.isArray(body.questions);
        } catch {
          return false;
        }
      },
    });

    if (testId) {
      // Get test detail
      const testDetailRes = http.get(`${BASE_URL}/api/tests/${testId}`, { headers: authHeaders });
      let answersToSubmit = [];
      check(testDetailRes, {
        'test details fetched': (r) => {
          try {
            const body = JSON.parse(r.body);
            answersToSubmit = (body.questions || []).map((q) => ({
              questionId: q.id,
              selectedOption: (q.options && q.options[0]) || 'Option A',
            }));
            return r.status === 200;
          } catch {
            return false;
          }
        },
      });

      // Submit test
      const submitPayload = JSON.stringify({
        answers: answersToSubmit,
      });
      const submitRes = http.post(`${BASE_URL}/api/tests/${testId}/submit`, submitPayload, {
        headers: authHeaders,
      });
      check(submitRes, {
        'test submitted status is 200': (r) => r.status === 200,
        'grading report includes score percentage': (r) => {
          try {
            const body = JSON.parse(r.body);
            return typeof body.scorePercentage === 'number';
          } catch {
            return false;
          }
        },
      });
    }
  });

  group('07. Session Security & Remote Revocation', () => {
    const sessionsRes = http.get(`${BASE_URL}/api/auth/sessions`, { headers: authHeaders });
    check(sessionsRes, {
      'sessions list fetched': (r) => r.status === 200,
      'has active session': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body) && body.length > 0;
        } catch {
          return false;
        }
      },
    });
  });

  sleep(1);
}
