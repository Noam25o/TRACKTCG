# Passation complète vers Claude

Date de passation : 5 novembre 2026.

## Résumé produit

TRACKTCG aide un collectionneur à scanner des cartes Pokémon TCG, consulter
leur identité et leurs repères de prix, puis gérer une collection sur téléphone.
La version web mobile est désormais la base du produit. L’application Expo
reste dans `expo-app/` comme piste native secondaire.

Le flux validé pendant les essais est :

1. l’utilisateur appuie sur Scanner ;
2. l’écran caméra prend toute la page immédiatement ;
3. le moteur prépare son index local en arrière-plan ;
4. le moteur tente jusqu’à dix analyses sans afficher le compteur ;
5. une carte reconnue ouvre une fiche premium sombre ;
6. Ajouter sauvegarde un lot local puis relance la caméra ;
7. après dix échecs, Relancer recommence la recherche.

## Architecture actuelle

`web-app/server.mjs` sert l’application, les routes catalogue/carte/prix et les
assets statiques authentifiés. `web-app/public/web.mjs` contrôle la navigation,
la fiche, le marché et la collection. `web-app/public/phone-scanner.mjs` monte
le scanner téléphone intégré. `web-app/phone/app.js` gère caméra, worker,
captures et analyse. `web-app/phone/worker.js` exécute le moteur local.

Les références sont distribuées par langue (FR, EN, JP), vérifiées par SHA-256
et conservées dans CacheStorage. Les cartes et lots sont persistés dans
IndexedDB via `web-app/public/storage.mjs` et `collection.mjs`.

Le serveur n’accepte aucun upload dans le flux public par défaut. Le mode
visuel PC est explicitement séparé et ne doit pas être activé par inadvertance.

## État technique

Le scanner local repose sur AUTO 3 + CACHE 1 et environ 2 000 références
(667 FR, 667 EN, 666 JP). Plusieurs essais iPhone ont confirmé la reconnaissance
de cartes FR/EN/JP, avec un premier chargement long puis un chargement cache
beaucoup plus court. Ces observations ne constituent pas encore une précision
statistique générale.

La dernière suite complète connue contient 120 tests Node réussis. Les tests
ciblés interface/scanner doivent être relancés après toute refonte visuelle.
Le build des assets téléphone se fait avec `npm run phone:build`.

## Données et limites

- TCGdex fournit fiches, images et repères Cardmarket/TCGplayer selon
  disponibilité.
- Les devises, dates, variantes et limites de correspondance doivent rester
  visibles dans les fiches détaillées.
- Les données utilisateur restent locales et exportables en JSON.
- Un nouveau tunnel Cloudflare ne récupère pas la collection IndexedDB de
  l’ancien domaine.
- Les clés de tunnel et configurations locales ne doivent pas être copiées dans
  ce document ni commitées.

## Commandes de reprise

```powershell
cd web-app
npm ci --ignore-scripts
npm run phone:build
npm test
npm run check
npm run share
```

Pour le client natif :

```powershell
cd expo-app
npm install
npm test
npm run lint
npx tsc --noEmit
```

Les APIs Expo changent entre versions. Lire `expo-app/AGENTS.md` avant toute
modification native.

## Fichiers à lire en premier

- `CLAUDE.md`
- `ROADMAP.md`
- `web-app/README.md`
- `web-app/phone/README.md`
- `docs/RECOGNITION.md`
- `docs/SEARCH_LANGUAGES.md`
- `expo-app/README.md`

## Travail recommandé ensuite

Commencer par un audit visuel et tactile du parcours Scanner sur Safari iPhone,
puis mesurer les temps réels sur cartes physiques. Ne pas commencer par une
réécriture native ni par une extension massive du catalogue : les risques
actuels sont surtout la fluidité, la couverture des impressions et la qualité
du retour utilisateur.
