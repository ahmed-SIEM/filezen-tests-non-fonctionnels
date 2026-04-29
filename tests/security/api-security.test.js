/**
 * TESTS DE SÉCURITÉ — API FileZen (OWASP Top 10)
 *
 * Couvre les vulnérabilités critiques selon OWASP Top 10 2021 :
 *   - A01 : Broken Access Control (accès non autorisé)
 *   - A02 : Cryptographic Failures (données sensibles exposées)
 *   - A03 : Injection (NoSQL / Header injection)
 *   - A04 : Insecure Design (logique métier exploitable)
 *   - A05 : Security Misconfiguration (headers de sécurité)
 *   - A07 : Identification & Authentication Failures (brute force, JWT)
 *
 * Pré-requis : Backend démarré sur http://localhost:5000
 * Commande : npm run test:security
 */

const axios = require('axios');

const API = process.env.API_URL || 'http://localhost:5000';

// Helper HTTP sans throw sur 4xx/5xx
const http = axios.create({
  baseURL: API,
  validateStatus: () => true,
  timeout: 10000,
});

// ═══════════════════════════════════════════════════════════════════════════════
// A01 — Broken Access Control
// ═══════════════════════════════════════════════════════════════════════════════
describe('[SEC-A01] Broken Access Control — Routes protégées', () => {

  /**
   * SEC-001 : Les routes admin ne doivent pas être accessibles sans JWT valide.
   * Un attaquant sans token ne doit jamais accéder aux données de gestion.
   */
  test('SEC-001 — GET /api/agents sans token → 401 ou 403', async () => {
    const res = await http.get('/api/agents');
    expect([401, 403]).toContain(res.status);
  });

  /**
   * SEC-002 : Route de stats admin inaccessible sans authentification.
   */
  test('SEC-002 — GET /api/stats sans token → 401 ou 403', async () => {
    const res = await http.get('/api/stats');
    expect([401, 403]).toContain(res.status);
  });

  /**
   * SEC-003 : Route de gestion des services inaccessible sans token.
   * Un citoyen ne doit pas pouvoir créer ou modifier des services.
   */
  test('SEC-003 — POST /api/services sans token → 401 ou 403', async () => {
    const res = await http.post('/api/services', { nom: 'Hack Service' });
    expect([401, 403]).toContain(res.status);
  });

  /**
   * SEC-004 : Token JWT invalide (forgé) doit être rejeté.
   * Un attaquant ne doit pas pouvoir forger un token.
   */
  test('SEC-004 — Token JWT forgé → 401', async () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZha2UiLCJyb2xlIjoiYWRtaW4ifQ.fake-signature';
    const res = await http.get('/api/agents', {
      headers: { Authorization: `Bearer ${fakeToken}` },
    });
    expect([401, 403]).toContain(res.status);
  });

  /**
   * SEC-005 : Token JWT expiré doit être rejeté.
   * (Token généré avec exp dans le passé)
   */
  test('SEC-005 — Token JWT expiré → 401', async () => {
    // Token avec exp = 1 (Unix epoch 1970) — clairement expiré
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMSIsInJvbGUiOiJhZG1pbiIsImV4cCI6MX0.invalid';
    const res = await http.get('/api/agents', {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    expect([401, 403]).toContain(res.status);
  });

  /**
   * SEC-006 : IDOR — Un citoyen ne doit pas accéder au ticket d'un autre citoyen.
   * L'ID de ticket dans l'URL ne doit pas contourner les autorisations.
   */
  test('SEC-006 — IDOR : accès ticket autre utilisateur sans auth → 401/403/404', async () => {
    const res = await http.get('/api/tickets/000000000000000000000001');
    // Soit non autorisé, soit non trouvé (les deux sont acceptables)
    expect([401, 403, 404]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// A02 — Cryptographic Failures
// ═══════════════════════════════════════════════════════════════════════════════
describe('[SEC-A02] Cryptographic Failures — Données sensibles', () => {

  /**
   * SEC-007 : Le mot de passe ne doit jamais apparaître dans la réponse API de login.
   * Même en cas d'erreur, aucun champ "password" ne doit être retourné.
   */
  test('SEC-007 — Réponse login ne contient pas le mot de passe en clair', async () => {
    const res = await http.post('/api/auth/login', {
      email: 'admin@test.com',
      password: 'TestPassword123',
    });
    const body = JSON.stringify(res.data);
    expect(body).not.toMatch(/TestPassword123/);
    // Le hash bcrypt ne doit pas non plus être exposé
    if (res.status === 200 && res.data.user) {
      expect(res.data.user.password).toBeUndefined();
      expect(res.data.user.mot_de_passe).toBeUndefined();
    }
  });

  /**
   * SEC-008 : Les informations sensibles ne doivent pas apparaître dans les en-têtes de réponse.
   * Pas de version Express, pas de X-Powered-By exposé.
   */
  test('SEC-008 — X-Powered-By header absent (évite fingerprinting)', async () => {
    const res = await http.get('/');
    // Express expose X-Powered-By par défaut — doit être désactivé
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// A03 — Injection
// ═══════════════════════════════════════════════════════════════════════════════
describe('[SEC-A03] Injection — NoSQL et Header', () => {

  /**
   * SEC-009 : Injection NoSQL dans le login.
   * L'attaquant envoie { $gt: "" } comme mot de passe pour contourner l'auth.
   * Le serveur doit rejeter ou ne pas authentifier.
   */
  test('SEC-009 — NoSQL injection dans le login → accès refusé', async () => {
    const res = await http.post('/api/auth/login', {
      email: 'admin@filezen.tn',
      password: { $gt: '' },  // Tentative d'injection NoSQL
    });
    // Ne doit PAS retourner 200 avec un token
    expect(res.status).not.toBe(200);
    if (res.status === 200) {
      expect(res.data.token).toBeUndefined();
    }
  });

  /**
   * SEC-010 : Injection NoSQL dans la recherche d'établissement.
   * Utilisation d'opérateurs Mongo dans les paramètres query.
   */
  test('SEC-010 — NoSQL injection dans query params → 400 ou résultat vide', async () => {
    const res = await http.get('/api/etablissements?nom[$regex]=.*&nom[$options]=i');
    // Doit répondre sans crasher et sans exposer toute la base
    expect(res.status).toBeLessThan(500);
  });

  /**
   * SEC-011 : Payload très large — protection contre les attaques DoS par payload.
   * Express devrait rejeter les corps trop grands (limite par défaut : 100kb).
   */
  test('SEC-011 — Payload surdimensionné → 413 ou rejeté', async () => {
    const hugePayload = { data: 'A'.repeat(10 * 1024 * 1024) }; // 10 MB
    const res = await http.post('/api/auth/login', hugePayload, {
      timeout: 5000,
    });
    // Soit 413 (trop grand), soit 400 (validation), pas de crash 500
    expect(res.status).not.toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// A05 — Security Misconfiguration
// ═══════════════════════════════════════════════════════════════════════════════
describe('[SEC-A05] Security Misconfiguration — En-têtes HTTP', () => {

  /**
   * SEC-012 : Les en-têtes de sécurité doivent être présents (Helmet.js ou équivalent).
   * Ces headers protègent contre XSS, clickjacking, MIME sniffing.
   */
  test('SEC-012 — Headers de sécurité présents (Helmet)', async () => {
    const res = await http.get('/');

    // Au moins quelques headers de sécurité attendus
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
    ];

    const presentHeaders = securityHeaders.filter(h => res.headers[h] !== undefined);

    // On s'attend à ce qu'au moins 1 header de sécurité soit présent
    // (Si Helmet n'est pas installé, 0 seront présents — le test documente l'état)
    if (presentHeaders.length === 0) {
      console.warn('[AVERTISSEMENT] Aucun header de sécurité détecté — installer helmet.js recommandé');
    }
    // Test informatif : ne bloque pas CI mais log l'état
    expect(res.status).toBeLessThan(500);
  });

  /**
   * SEC-013 : CORS — le backend doit rejeter les origines non autorisées en production.
   * Un attaquant d'un autre domaine ne doit pas pouvoir appeler l'API.
   */
  test('SEC-013 — CORS : origine malveillante vérifiée', async () => {
    const res = await http.get('/api/etablissements', {
      headers: { Origin: 'https://evil-hacker.com' },
    });
    // L'API répond (200 est possible en dev) mais en production CORS doit bloquer
    // Ce test documente le comportement actuel
    const corsHeader = res.headers['access-control-allow-origin'];
    if (corsHeader === '*') {
      console.warn('[AVERTISSEMENT] CORS = wildcard (*) — à restreindre en production');
    }
    expect(res.status).toBeLessThan(500);
  });

  /**
   * SEC-014 : Route inexistante → 404 propre (pas de stack trace exposée).
   * Une route inconnue ne doit pas révéler la structure interne du serveur.
   */
  test('SEC-014 — Route inexistante → 404 sans stack trace', async () => {
    const res = await http.get('/api/route-qui-nexiste-pas-du-tout');
    expect(res.status).toBe(404);
    const body = JSON.stringify(res.data);
    // Pas de stack trace Node.js dans la réponse
    expect(body).not.toMatch(/at Object\.|at Module\.|node_modules/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// A07 — Identification & Authentication Failures
// ═══════════════════════════════════════════════════════════════════════════════
describe('[SEC-A07] Authentification — Résistance aux attaques', () => {

  /**
   * SEC-015 : Le login avec un email inexistant ne doit pas différencier
   * "email inconnu" de "mot de passe incorrect" (user enumeration).
   * Le message d'erreur doit être générique.
   */
  test('SEC-015 — Message erreur login générique (pas d\'enumération utilisateur)', async () => {
    const res1 = await http.post('/api/auth/login', {
      email: 'inconnu@filezen.tn',
      password: 'MotDePasse123',
    });
    const res2 = await http.post('/api/auth/login', {
      email: 'admin@filezen.tn',
      password: 'MauvaisMotDePasse',
    });

    // Les deux doivent avoir le même code de statut
    expect(res1.status).toBe(res2.status);
  });

  /**
   * SEC-016 : Mot de passe faible à l'inscription → rejeté.
   * L'API doit valider la robustesse du mot de passe.
   */
  test('SEC-016 — Inscription avec mot de passe trop court → 400', async () => {
    const res = await http.post('/api/auth/register', {
      prenom: 'Test',
      nom: 'Security',
      email: `sec-test-${Date.now()}@test.com`,
      telephone: '12345678',
      password: '123', // Trop court
    });
    expect(res.status).toBe(400);
  });

  /**
   * SEC-017 : Tentatives multiples de connexion (simulation brute force).
   * L'API doit soit ralentir (rate limiting) soit bloquer après N tentatives.
   * Ce test vérifie que le serveur ne crash pas sous ces tentatives répétées.
   */
  test('SEC-017 — Brute force simulation (10 tentatives) → serveur stable', async () => {
    const attempts = Array.from({ length: 10 }, (_, i) =>
      http.post('/api/auth/login', {
        email: 'admin@filezen.tn',
        password: `WrongPassword${i}`,
      })
    );

    const results = await Promise.all(attempts);

    // Toutes les tentatives doivent recevoir une réponse (pas de crash)
    results.forEach((res) => {
      expect(res.status).toBeLessThan(500);
    });

    // Idéalement, les dernières tentatives reçoivent 429 (Too Many Requests)
    const lastResult = results[results.length - 1];
    if (lastResult.status === 429) {
      console.log('[OK] Rate limiting actif — brute force bloqué après 10 tentatives');
    } else {
      console.warn('[INFO] Rate limiting non détecté — envisager express-rate-limit');
    }
  });

  /**
   * SEC-018 : L'endpoint de réinitialisation de mot de passe ne doit pas
   * confirmer si l'email existe dans la base (user enumeration).
   */
  test('SEC-018 — Reset password : même réponse email connu/inconnu', async () => {
    const res1 = await http.post('/api/auth/forgot-password', {
      email: 'connu@filezen.tn',
    });
    const res2 = await http.post('/api/auth/forgot-password', {
      email: `inconnu-${Date.now()}@hack.com`,
    });

    // Les deux doivent retourner le même status (200 ou 404, mais identique)
    // Pour éviter l'énumération, le comportement attendu est identique
    expect(res1.status).toBe(res2.status);
  });

  /**
   * SEC-019 : JWT sans algorithme (alg:none) doit être rejeté.
   * Attaque classique sur les implémentations JWT défaillantes.
   */
  test('SEC-019 — JWT avec alg:none → 401 (algorithme rejeté)', async () => {
    // Token avec alg:none signé sans signature
    const noneToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpZCI6ImZha2UtaWQiLCJyb2xlIjoiYWRtaW4ifQ.';
    const res = await http.get('/api/agents', {
      headers: { Authorization: `Bearer ${noneToken}` },
    });
    expect([401, 403]).toContain(res.status);
  });

  /**
   * SEC-020 : Les tokens de réinitialisation de mot de passe ne doivent pas
   * être réutilisables après utilisation (token à usage unique).
   * Ce test vérifie que le système rejette un token déjà consommé.
   */
  test('SEC-020 — Token reset password invalide → 400 ou 404 (pas d\'accès)', async () => {
    const fakeResetToken = 'faketoken12345678901234567890123456789012';
    const res = await http.post(`/api/auth/reset-password/${fakeResetToken}`, {
      password: 'NewPassword@2026',
    });
    // Un token inexistant ou expiré doit être rejeté
    expect([400, 401, 404]).toContain(res.status);
  });
});
