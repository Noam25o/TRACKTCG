# TRACKTCG — contexte de travail pour Claude

TRACKTCG est une application web mobile de collection de cartes Pokémon TCG.
Le parcours prioritaire est Safari sur iPhone : ouvrir le scanner, reconnaître
une carte localement, afficher sa fiche et son prix, puis l’ajouter à une
collection locale.

## Organisation

- `web-app/` : produit principal web mobile, serveur Node, catalogue, scanner
  local, prix, collection IndexedDB, tests et moteur visuel expérimental.
- `web-app/phone/` : scanner ORB/OpenCV WebAssembly exécuté dans le navigateur.
- `web-app/public/` : interface web principale.
- `web-app/visual/` : pilote PC expérimental, benchmarks et OCR CPU isolé.
- `web-app/tests/` : tests Node du web, du scanner et du serveur.
- `expo-app/` : ancienne application Expo/React Native, conservée comme piste
  native mais secondaire.
- `docs/` : décisions produit, reconnaissance, images et recherche de langues.

Lire ensuite `docs/CLAUDE_MIGRATION.md`, puis `ROADMAP.md` et
`web-app/README.md` avant de modifier le comportement du scanner.

## Commandes principales

Depuis `web-app/` :

```powershell
npm ci --ignore-scripts
npm run phone:build
npm test
npm run check
npm run share
```

`npm run share` ouvre volontairement un tunnel Cloudflare temporaire pour les
tests iPhone. Le domaine et la clé changent à chaque lancement. La collection
IndexedDB est attachée au domaine : exporter avant de changer de lien.

Si le test catalogue ne trouve pas TypeScript, utiliser le dossier de
dépendances de test local s’il existe :

```powershell
$env:NODE_PATH=(Resolve-Path '.tools/test-deps/node_modules').Path
npm test
```

## Décisions produit à préserver

- Le bouton central `Scanner` ouvre directement la caméra plein écran.
- Les dix tentatives automatiques restent silencieuses à l’écran ; après échec,
  seul le bouton `Relancer` est visible.
- Une reconnaissance ouvre un résultat premium sombre inspiré d’iOS : image,
  rareté, nom, extension/numéro, langue, prix, `Ajouter`, `Voir les détails` et
  `Re-scanner`.
- Après `Ajouter`, la caméra reprend automatiquement.
- Le moteur local ne téléverse pas les photos par défaut. Le pilote PC visuel
  est opt-in uniquement avec `npm run share:visual`.
- Les prix sont des repères de marché datés, jamais une estimation garantie.
- Ne pas agrandir l’index ou changer les seuils de reconnaissance sans benchmark.

## Règles de modification

Conserver les changements non commités présents dans le dépôt. Ne pas faire de
reset destructif. Pour une modification Expo, lire `expo-app/AGENTS.md`, vérifier
la version Expo dans `expo-app/package.json` et consulter la documentation de la
version avant d’utiliser une API native.

Pour une modification web, lancer au minimum les tests ciblés puis `npm run
check`. Pour une modification du scanner, vérifier les cycles caméra,
annulation, retour après résultat et échec après dix essais.

## Prochaines priorités

1. Valider le nouveau rendu premium et le parcours caméra sur plusieurs iPhone.
2. Mesurer séparément premier chargement, chargement cache et temps de
   reconnaissance sur cartes physiques.
3. Améliorer la couverture des références FR/EN/JP sans dégrader le temps de
   démarrage.
4. Décider plus tard si l’application Expo doit redevenir prioritaire.
