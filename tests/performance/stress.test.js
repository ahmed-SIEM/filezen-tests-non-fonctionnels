/**
 * TEST DE PERFORMANCE — Stress Test (k6)
 *
 * Objectif : Trouver le point de rupture du système en augmentant progressivement
 * la charge jusqu'à 200 utilisateurs simultanés.
 * Mesure : à partir de quel point les temps de réponse dégradent et les erreurs apparaissent.
 *
 * Commande : k6 run tests/performance/stress.test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate   = new Rate('errors');
const apiLatency  = new Trend('api_latency', true);

export const options = {
  stages: [
    { duration: '2m',  target: 50  }, // Normal
    { duration: '2m',  target: 100 }, // Au-dessus de la normale
    { duration: '2m',  target: 200 }, // Stress élevé
    { duration: '2m',  target: 300 }, // Extrême
    { duration: '2m',  target: 0   }, // Récupération
  ],

  thresholds: {
    // En stress, on tolère plus de latence mais pas de crash serveur
    http_req_duration: ['p(99)<5000'],
    errors: ['rate<0.15'],
    http_req_failed: ['rate<0.15'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:5000';

export default function () {

  // Route la plus sollicitée : liste établissements (publique, sans auth)
  const res = http.get(`${BASE_URL}/api/etablissements`, {
    tags: { name: 'StressEtablissements' },
  });

  const ok = check(res, {
    '[STRESS] Serveur répond (pas de crash)': (r) => r.status < 500,
    '[STRESS] Réponse < 5s même sous stress': (r) => r.timings.duration < 5000,
  });

  errorRate.add(!ok);
  apiLatency.add(res.timings.duration);

  sleep(0.5);

  // Route authentification sous stress
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: 'stress@test.com', password: 'WrongPass' }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'StressLogin' } }
  );

  const loginOK = check(loginRes, {
    '[STRESS] Login répond (pas de timeout)': (r) => r.status < 500,
  });

  errorRate.add(!loginOK);
  apiLatency.add(loginRes.timings.duration);

  sleep(1);
}
