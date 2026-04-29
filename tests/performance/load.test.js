/**
 * TEST DE PERFORMANCE — Load Test (k6)
 *
 * Objectif : Simuler la charge normale d'utilisation (50 utilisateurs simultanés).
 * Scénario : Montée progressive 0→50 VU, maintien 5 min, descente.
 *
 * Commande : k6 run tests/performance/load.test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Métriques personnalisées ─────────────────────────────────────────────────
const errorRate        = new Rate('errors');
const ticketCreateTime = new Trend('ticket_create_duration', true);
const loginTime        = new Trend('login_duration', true);
const requestCount     = new Counter('total_requests');

// ─── Configuration du scénario ───────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '1m',  target: 10  }, // Montée douce → 10 VU
    { duration: '2m',  target: 50  }, // Montée vers charge nominale
    { duration: '5m',  target: 50  }, // Maintien à 50 VU (charge normale)
    { duration: '1m',  target: 0   }, // Descente progressive
  ],

  thresholds: {
    // 95% des requêtes < 1 seconde en charge normale
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    // Taux d'erreur < 5%
    errors: ['rate<0.05'],
    http_req_failed: ['rate<0.05'],
    // Prise de ticket < 2s
    ticket_create_duration: ['p(95)<2000'],
    // Connexion < 1s
    login_duration: ['p(95)<1000'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:5000';

// Token partagé simulé (en vrai : obtenu via login dans setup())
let authToken = __ENV.TEST_TOKEN || null;

// ─── Scénario principal ───────────────────────────────────────────────────────
export default function () {

  group('Parcours citoyen — consultation', () => {

    // Lister les établissements
    const res1 = http.get(`${BASE_URL}/api/etablissements`, {
      tags: { name: 'ListEtablissements' },
    });
    requestCount.add(1);
    check(res1, {
      '[LOAD] GET /etablissements → 200': (r) => r.status === 200,
      '[LOAD] Réponse < 1s': (r) => r.timings.duration < 1000,
    });
    errorRate.add(res1.status !== 200);
    sleep(0.5);
  });

  group('Authentification', () => {

    const loginPayload = JSON.stringify({
      email: `loadtest+${__VU}@filezen.tn`,
      password: 'LoadTest@2026',
    });

    const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'Login' },
    });
    requestCount.add(1);
    loginTime.add(loginRes.timings.duration);

    // Accepter succès (200) ou identifiants inconnus (400/401)
    check(loginRes, {
      '[LOAD] Login répond': (r) => r.status < 500,
      '[LOAD] Login < 1s': (r) => r.timings.duration < 1000,
    });
    errorRate.add(loginRes.status >= 500);

    if (loginRes.status === 200) {
      const body = JSON.parse(loginRes.body);
      authToken = body.token || authToken;
    }
    sleep(1);
  });

  group('Consultation file d\'attente', () => {
    if (!authToken) return;

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };

    // Simuler une consultation de la file d'un service
    const serviceId = __ENV.TEST_SERVICE_ID || '000000000000000000000001';
    const res = http.get(`${BASE_URL}/api/tickets/service/${serviceId}/file`, {
      headers,
      tags: { name: 'GetFile' },
    });
    requestCount.add(1);
    check(res, {
      '[LOAD] GET file d\'attente < 2s': (r) => r.timings.duration < 2000,
      '[LOAD] GET file d\'attente répond': (r) => r.status < 500,
    });
    errorRate.add(res.status >= 500);
    sleep(2);
  });
}
