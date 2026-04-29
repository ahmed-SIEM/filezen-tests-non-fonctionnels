# Visualisation k6 + Grafana — FileZen

## Option 1 : k6 Web Dashboard (intégré, le plus simple)

k6 v0.43+ inclut un dashboard web natif — **aucune installation supplémentaire**.

```bash
# Lancer avec dashboard web
k6 run --out web-dashboard tests/performance/load.test.js

# Ouvre automatiquement http://127.0.0.1:5665
# Graphiques temps réel : VUs, latence p95/p99, taux d'erreur
```

---

## Option 2 : k6 + InfluxDB + Grafana (production-grade)

### 2.1 Installer avec Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  influxdb:
    image: influxdb:1.8
    ports:
      - "8086:8086"
    environment:
      - INFLUXDB_DB=k6
      - INFLUXDB_HTTP_AUTH_ENABLED=false

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
    volumes:
      - grafana-storage:/var/lib/grafana

volumes:
  grafana-storage:
```

```bash
# Démarrer InfluxDB + Grafana
docker-compose up -d

# Lancer k6 avec sortie vers InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 tests/performance/load.test.js
```

### 2.2 Configurer Grafana

1. Ouvrir http://localhost:3001
2. Ajouter datasource → InfluxDB → URL: `http://influxdb:8086` → Database: `k6`
3. Importer le dashboard officiel k6 : **ID 2587** (k6 Load Testing Results)
   - Dashboard → Import → Grafana.com → ID: `2587`

### 2.3 Métriques disponibles dans Grafana

| Métrique k6 | Description |
|-------------|-------------|
| `http_req_duration` | Temps de réponse (p50, p95, p99) |
| `http_req_failed` | Taux d'échec des requêtes |
| `http_reqs` | Nombre de requêtes/seconde |
| `vus` | Utilisateurs virtuels actifs |
| `vus_max` | Maximum VUs atteint |
| `iterations` | Itérations complétées |
| `errors` (custom) | Taux d'erreur métier |
| `api_latency` (custom) | Latence API personnalisée |

---

## Option 3 : k6 Cloud (SaaS, sans infrastructure)

```bash
# Connexion
k6 login cloud --token <VOTRE_TOKEN>

# Lancer en cloud
k6 cloud tests/performance/load.test.js

# Dashboard disponible sur https://app.k6.io
```

---

## Commandes de lancement complet

```bash
# Smoke test (1 VU, 1 min) — vérifie que tout fonctionne
k6 run tests/performance/smoke.test.js

# Load test avec web dashboard
k6 run --out web-dashboard tests/performance/load.test.js

# Stress test avec InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 tests/performance/stress.test.js

# Spike test
k6 run tests/performance/spike.test.js

# Avec variables d'environnement
k6 run -e API_URL=http://localhost:5000 -e TEST_TOKEN=xxx tests/performance/load.test.js
```
