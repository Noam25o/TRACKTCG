# TRACKTCG

Application web pensée pour le téléphone, pour scanner, reconnaître, valoriser
et gérer une collection de cartes TCG. Une application native Android/iOS reste
une option ultérieure, à décider après validation de la version web.

## État du projet

Un [labo statique de reconnaissance dans le navigateur](web-app/phone/README.md)
est disponible depuis le 9 octobre, sans upload ni calcul Python. AUTO 3 a été
confirmé sur iPhone 14 Pro avec Pikachu et quatre autres cartes FR/EN/JP ; la
référence Badge absente est refusée. CACHE 1 compresse les téléchargements et
conserve les références localement. Le 22 octobre, l'utilisateur rapporte
18 s au premier chargement puis 1,2 s après rechargement sur iPhone ; Tortank-ex
FR et Butterfree VMAX EN sont reconnues sur les images de référence proposées.
Le scanner local est désormais intégré au parcours web principal : les
propositions ouvrent les fiches, les repères de prix disponibles et l'ajout
confirmé à la collection. Ce nouveau parcours reste à tester sur iPhone.
Le labo autonome et les anciens modes sont conservés.

## Reprendre sur un autre ordinateur

Installer Node.js 22 ou plus récent, récupérer le dépôt, puis :

```powershell
cd web-app
npm ci --ignore-scripts
npm run phone:build
npm run phone:preview
```

L'index validé de 2 000 références (`web-app/visual/data/index.json`, environ
65,4 Mo) est versionné pour reproduire le labo sans Python ni reconstruction du
catalogue. Les dépendances, outils locaux, fichiers générés, secrets et captures
de test sont exclus. `phone:preview` affiche un nouveau lien local protégé.
Pour tester la caméra sur iPhone, recréer un accès HTTPS avec l'outil officiel
cloudflared ou un hébergement statique ; les anciens tunnels ne sont pas transférés.
Le cache Safari appartient au domaine utilisé et n'est pas contenu dans Git.
Les éventuelles configurations locales doivent être transférées séparément et
privément ; `expo-app/.env.example` ne contient que les noms des variables.

La V1 Pokémon est en cours de construction. Le prototype Safari est la base du
scanner web : comparaison réelle à un petit lot d'images, candidats à confirmer.
Un premier essai utilisateur sur iPhone a retrouvé le bon Raichu parmi les trois
candidats. L'utilisateur rapporte environ 2–3 secondes avec plus de 50 références,
sans protocole de benchmark ni mesure de précision globale.

La version web réunit maintenant catalogue TCGdex paginé, recherche FR/EN/JP
depuis les noms français, fiches, scanner et collection locale IndexedDB.
L'ajout demande une vérification manuelle ; quantités, finition, état et coût
d'achat facultatif sont conservés. Export/import JSON volontaire, sans remplacer
les lots existants. Repères Cardmarket/TCGplayer disponibles via TCGdex, sans
estimation garantie propre à la langue/état ; synchronisation Firebase à intégrer.
La collection Expo est conservée et ne se transfère pas automatiquement.

**Sauvegarder avant de changer de lien de test** : la collection appartient au
navigateur et à l'adresse utilisée. Un autre domaine Cloudflare temporaire ne
retrouve pas ces données ; exporter puis importer volontairement sur le nouveau
lien. Le stockage navigateur peut aussi être effacé : garder un fichier de sauvegarde.

Contrainte ferme de production : **téléphone + Cloudflare doivent suffire**.
Firebase est facultatif pour comptes, profils et données. Aucun VPS, serveur
de reconnaissance dédié ou PC personnel allumé en permanence. Cible à valider :
reconnaissance dans le navigateur mobile, modèles/index distribués par Cloudflare.
Le pilote Python actuel ne satisfait pas encore cette cible et reste un outil
de développement ; priorité au portage et aux mesures réelles sur iPhone.
Développement local ; le lien Cloudflare temporaire autorisé sert aux tests,
pas à une publication permanente. Un index visuel partiel de 2 000 empreintes
(667 FR, 667 EN, 666 JP) est désormais préparé ; couverture complète à construire.
Le contrôle synthétique du 7 octobre retrouve la bonne référence en premier sur
54 requêtes, également avec les références WebP qualité 50 de l’échantillon.
Ce n’est pas une précision mesurée sur iPhone ; voir le protocole et ses limites
dans [le bilan visuel](./web-app/visual/README.md).

- [Feuille de route](./ROADMAP.md)
- [Projet Expo conservé, application native optionnelle](./expo-app/README.md)
- [État et prochaines étapes de la reconnaissance](./docs/RECOGNITION.md)
- [Recherche en français des cartes anglaises et japonaises](./docs/SEARCH_LANGUAGES.md)
- [Version web, collection et test iPhone sans build natif](./web-app/README.md)

Le moteur ArcFace/PaddleOCR n'est pas intégré au scanner : PaddleOCR est seulement installé dans un [banc CPU isolé](web-app/visual/OCR_CPU.md). Le bouton de test du scanner Expo utilise un résultat local de développement clairement identifié. Aucun déploiement permanent ; le prototype Safari peut être exposé par un tunnel temporaire autorisé. Le PC sert au développement, pas de dépendance prévue à son GPU ou à son fonctionnement permanent en production.

Nouveau pilote web autorisé : capture de la carte entière envoyée via Cloudflare
au PC Windows, reconnaissance classique OpenCV ORB/RANSAC dans un index
partiel, sans lecture obligatoire du nom, API d’IA tierce ou photos conservées.
Activation explicite `npm run share:visual` dans `web-app`. Aperçu vivant
pendant traitement puis candidats à confirmer ; qualité iPhone à mesurer.
Les anciens modes OCR/manuels gardent l’image sur le téléphone. Le scanner
Expo reste une démonstration. Aucun tunnel ouvert automatiquement.

Parcours sans saisie : le lien public conserve le moteur visuel rapide,
sans formulaire ni bouton OCR. Une lecture automatique du numéro est préparée
en diagnostic local uniquement : sur onze exemples publics dégradés, les onze
cartes sont retrouvées et trois numéros sont confirmés. Elle reste désactivée sur le tunnel
pour ne pas ralentir les scans sans gain démontré. Le PC redresse le bas de la
capture originale ; seul ce bandeau retourne au téléphone pour l’OCR local.
Pas de bouton OCR ni de champ numéro/extension. Lecture bornée à huit secondes,
annulée à la sortie/arrière-plan ; images libérées après analyse, sans cache
photo aux résultats. En cas de doute : recadrage ou confirmation visuelle,
jamais saisie imposée. Le total d’une fraction ne prouve pas l’extension.
