# Rapport de Tests Non-Fonctionnels — FileZen

> **Projet** : FileZen  
> **Type** : Tests non-fonctionnels (Performance + Sécurité)  
> **Date** : 2026-04-26  

---

## 1. Vue d'ensemble

Les tests non-fonctionnels valident les propriétés **qualitatives** du système :
- **Performance** : le système répond-il dans des délais acceptables sous charge ?
- **Sécurité** : le système résiste-t-il aux attaques courantes (OWASP Top 10) ?

---

## 2. Tests de performance (k6)

### 2.1 Outils utilisés

| Outil | Usage | Lien |
|-------|-------|------|
| **k6** | Exécution des scénarios de charge | https://k6.io |
| **k6 dashboard** | Visualisation temps réel | `k6 run --out dashboard` |

### 2.2 Scénarios de test

| Fichier | Type | VU max | Durée | Objectif |
|---------|------|--------|-------|----------|
| `smoke.test.js` | Smoke | 1 VU | 1 min | Vérification de base |
| `load.test.js` | Load | 50 VU | 9 min | Charge nominale |
| `stress.test.js` | Stress | 300 VU | 10 min | Point de rupture |
| `spike.test.js` | Spike | 500 VU | 1m20s | Pic brutal (ouverture service) |

### 2.3 Seuils définis

| Scénario | p95 | p99 | Taux d'erreur max |
|----------|-----|-----|-------------------|
| Smoke    | < 500ms | — | < 1% |
| Load     | < 1000ms | < 2000ms | < 5% |
| Stress   | — | < 5000ms | < 15% |
| Spike    | < 3000ms | — | < 20% |

### 2.4 Comment exécuter

```bash
# Installer k6 (Windows)
winget install k6 --source winget

# Ou via Chocolatey
choco install k6

# Lancer un test
k6 run tests/performance/smoke.test.js

# Avec paramètres personnalisés
k6 run tests/performance/load.test.js -e API_URL=http://localhost:5000 -e TEST_TOKEN=votre_jwt

# Générer un rapport HTML
k6 run tests/performance/load.test.js --out html=perf-report.html
```

---

## 3. Tests de sécurité (Jest + Axios)

### 3.1 Vulnérabilités testées (OWASP Top 10 2021)

| Réf OWASP | Catégorie | Tests |
|-----------|-----------|-------|
| A01 | Broken Access Control | SEC-001 à SEC-006 |
| A02 | Cryptographic Failures | SEC-007 à SEC-008 |
| A03 | Injection (NoSQL) | SEC-009 à SEC-011 |
| A05 | Security Misconfiguration | SEC-012 à SEC-014 |
| A07 | Auth Failures | SEC-015 à SEC-020 |

### 3.2 Tests de sécurité détaillés

| ID | Description | Criticité |
|----|-------------|-----------|
| SEC-001 | Routes admin sans token → 401/403 | **Critique** |
| SEC-002 | Route stats sans token → 401/403 | **Critique** |
| SEC-003 | Création service sans token → 401/403 | **Critique** |
| SEC-004 | JWT forgé → rejeté | **Critique** |
| SEC-005 | JWT expiré → rejeté | **Haute** |
| SEC-006 | IDOR ticket autre utilisateur | **Critique** |
| SEC-007 | Mot de passe absent de la réponse login | **Critique** |
| SEC-008 | X-Powered-By absent | **Moyenne** |
| SEC-009 | NoSQL injection dans login | **Critique** |
| SEC-010 | NoSQL injection dans query | **Haute** |
| SEC-011 | Payload surdimensionné (DoS) | **Haute** |
| SEC-012 | Headers de sécurité (Helmet) | **Haute** |
| SEC-013 | CORS origine malveillante | **Haute** |
| SEC-014 | 404 sans stack trace | **Moyenne** |
| SEC-015 | Pas d'énumération utilisateur | **Haute** |
| SEC-016 | Mot de passe faible rejeté | **Critique** |
| SEC-017 | Résistance brute force | **Haute** |
| SEC-018 | Reset password : pas d'énumération | **Haute** |
| SEC-019 | JWT alg:none rejeté | **Critique** |
| SEC-020 | Token reset à usage unique | **Haute** |

### 3.3 Comment exécuter

```bash
# Installer les dépendances
npm install

# Lancer les tests de sécurité (backend doit être démarré)
npm run test:security

# Avec URL personnalisée
API_URL=http://localhost:5000 npm run test:security

# Générer le rapport Allure
npm run allure:generate
npm run allure:open
```

---

## 4. Recommandations de sécurité identifiées

| Priorité | Recommandation | Raison |
|----------|---------------|--------|
| **P0** | Valider tous les inputs avec express-validator | Prévient injection NoSQL et XSS |
| **P0** | Ajouter `helmet()` middleware | Headers de sécurité automatiques |
| **P1** | Implémenter express-rate-limit | Protège contre brute force (A07) |
| **P1** | Restreindre CORS en production | Limiter aux domaines autorisés |
| **P1** | Désactiver X-Powered-By | `app.disable('x-powered-by')` |
| **P2** | Ajouter Content Security Policy | Protège contre XSS côté navigateur |
| **P2** | Logs de sécurité (tentatives échouées) | Détection d'intrusion |

---

## 5. Structure du projet

```
filezen-tests-non-fonctionnels/
├── package.json
├── jest.config.js
├── docs/
│   └── rapport-tests-non-fonctionnels.md
├── tests/
│   ├── performance/
│   │   ├── smoke.test.js      ← 1 VU, 1 min (validation de base)
│   │   ├── load.test.js       ← 50 VU, 9 min (charge nominale)
│   │   ├── stress.test.js     ← 300 VU, 10 min (point de rupture)
│   │   └── spike.test.js      ← 500 VU, pic brutal (ouverture service)
│   └── security/
│       └── api-security.test.js  ← 20 tests OWASP (Jest + Axios)
└── allure-results/            ← Généré après npm run test:security
```
