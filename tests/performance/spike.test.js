/**
 * TEST DE PERFORMANCE — Spike Test (k6)
 *
 * Objectif : Simuler un pic soudain d'utilisateurs (ex : heure d'ouverture d'un service).
 * Scénario : 0 → 500 VU en 10 secondes, maintien 1 min, retour à 0.
 * Cas réel : tous les citoyens tentent de prendre un ticket à 8h00 pile.
 *
 * Commande : k6 run tests/performance/spike.test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '10s', target: 500 }, // Pic brutal → 500 VU en 10 secondes
    { duration: '1m',  target: 500 }, // Maintien du pic
    { duration: '10s', target: 0   }, // Redescente rapide
  ],

  thresholds: {
    // Pendant un spike, on accepte plus de dégradation
    http_req_duration: ['p(95)<3000'],
    errors: ['rate<0.20'],
    http_req_failed: ['rate<0.20'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:5000';

export default function () {

  // Le geste le plus concurrent : tous veulent prendre un ticket en même temps
  const res = http.get(`${BASE_URL}/api/etablissements`, {
    tags: { name: 'SpikeEtablissements' },
  });

  const ok = check(res, {
    '[SPIKE] Pas de 503 Service Unavailable': (r) => r.status !== 503,
    '[SPIKE] Pas de timeout complet': (r) => r.status < 500,
    '[SPIKE] Réponse < 3s même sous pic': (r) => r.timings.duration < 3000,
  });

  errorRate.add(!ok);
  sleep(0.1); // Pas de pause — le pic est brutal
}
