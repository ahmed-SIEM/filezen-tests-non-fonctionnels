/**
 * TEST DE PERFORMANCE — Smoke Test (k6)
 *
 * Objectif : Vérifier que le backend répond correctement sous charge minimale.
 * Scénario : 1 utilisateur virtuel, 1 minute, seuils de base.
 *
 * Commande : k6 run tests/performance/smoke.test.js
 * Pré-requis : k6 installé (https://k6.io/docs/getting-started/installation/)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── Métriques personnalisées ─────────────────────────────────────────────────
const errorRate      = new Rate('errors');
const apiLatency     = new Trend('api_latency', true);

// ─── Configuration du scénario ───────────────────────────────────────────────
export const options = {
  vus: 1,          // 1 utilisateur virtuel
  duration: '1m',  // durée : 1 minute

  thresholds: {
    // 95% des requêtes doivent répondre en moins de 500ms
    http_req_duration: ['p(95)<500'],
    // Taux d'erreur < 1%
    errors: ['rate<0.01'],
    // 100% des requêtes doivent réussir
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:5000';

// ─── Scénario principal ───────────────────────────────────────────────────────
export default function () {

  // 1. Liste établissements — route publique principale
  const etablissementsRes = http.get(`${BASE_URL}/api/etablissements`);
  const etablissementsOK = check(etablissementsRes, {
    '[SMOKE] GET /api/etablissements → 200': (r) => r.status === 200,
    '[SMOKE] Réponse JSON valide': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('json'),
    '[SMOKE] Temps réponse < 1000ms': (r) => r.timings.duration < 1000,
  });
  errorRate.add(!etablissementsOK);
  apiLatency.add(etablissementsRes.timings.duration);

  sleep(1);

  // 2. Authentification — mauvais credentials → doit répondre 400 ou 401
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: 'smoke@test.com', password: 'wrongpassword' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  const loginOK = check(loginRes, {
    '[SMOKE] POST /api/auth/login répond': (r) => r.status === 400 || r.status === 401 || r.status === 404,
    '[SMOKE] Réponse rapide < 1000ms': (r) => r.timings.duration < 1000,
  });
  errorRate.add(!loginOK);
  apiLatency.add(loginRes.timings.duration);

  sleep(1);

  // 3. Tentative d'accès protégé sans token → doit répondre 401
  const protectedRes = http.get(`${BASE_URL}/api/etablissements/me/etablissement`);
  const protectedOK = check(protectedRes, {
    '[SMOKE] Route protégée → 401 sans token': (r) => r.status === 401 || r.status === 403,
    '[SMOKE] Temps réponse < 1000ms': (r) => r.timings.duration < 1000,
  });
  errorRate.add(!protectedOK);
  apiLatency.add(protectedRes.timings.duration);

  sleep(2);
}
