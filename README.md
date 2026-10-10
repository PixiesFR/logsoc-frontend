# LogSOC Frontend

> **LogSOC** = **L**ibre · **O**pen · **G**ouvernance · **S**écurité · **O**pérations · **C**onformité

Interface web de la plateforme LogSOC : React 18 + TypeScript + Vite + Tailwind.

Le frontend communique avec le backend LogSOC via `/api/` (REST) et `/ws/` (temps réel).

## Build

```bash
npm install
npm run build     # tsc -b strict + vite build → dist/
```

La variable `VITE_API_URL` doit rester vide en production (le reverse-proxy sert `/api/`).

Voir `docs/INSTALLATION.md` du dépôt backend pour le déploiement complet.
