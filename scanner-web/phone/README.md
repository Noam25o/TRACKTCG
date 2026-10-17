# Labo de reconnaissance sur téléphone — 9 octobre 2026

Premier portage ORB + pHash + RANSAC dans un Web Worker OpenCV.js/WASM.
Ce dossier est un **essai indépendant**, pas un remplacement du scanner public
historique. Ni PaddleOCR, ni Python, ni service d'inférence n'interviennent dans
la reconnaissance de cette page. Les fichiers de `dist/` suffisent à l'exécuter
sur un hébergement statique HTTPS ; aucun backend applicatif n'est requis par
ce labo. Cloudflare reste prévu pour le futur bucket, Firebase facultatif pour
comptes/profils/données. Aucun bucket, compte ou déploiement permanent créé.

## Fonctionnement

- Choix de langue FR/EN/JP, chargement de l'index correspondant, puis caméra
  volontaire ou photo locale. Aucun nom/numéro/extension à saisir.
- Détection approximative du quadrilatère, normalisation 450 × 630, ORB 600
  points, présélection pHash sur toute la langue puis comparaison de 80 voisins.
  RANSAC et seuils géométriques repris de la baseline Python (24 points minimum,
  ratio 0,4, couverture 0,08). DCT 32 × 32 implémentée en JS car non exportée.
- Affichage de trois propositions maximum, jamais d'identité garantie ni
  d'ajout automatique. Pas d'OCR du numéro, prix, collection, détection de
  finition ni détection automatique de langue dans ce labo.
- AUTO 3 (10 octobre) : guide de proportion 63:88 et recadrage correspondant
  avec 4 % de marge de chaque côté. Ancien cadre ~0,818 au lieu de 0,716,
  environ 14 % trop large. La zone cadrée est normalisée sans recherche d'un
  second contour ; si elle ne donne rien, l'image complète du capteur passe
  par le chemin historique (contours puis comparaison). Deux calculs maximum
  par tentative, strictement séquentiels, mêmes seuils de reconnaissance.
- Auto : premier essai après 1 s, puis 900 ms de repos après chaque tentative
  infructueuse. Plus de blocage par StabilityGate (conservé pour les anciens
  bancs). Arrêt sur proposition, ou pause après dix essais / 25 s avant nouvel
  essai ; un calcul déjà en cours peut dépasser cette durée. La caméra reste
  ouverte en pause jusqu'à arrêt, sortie ou relance ; refaire un test de chauffe.
  En manuel, caméra arrêtée immédiatement après capture ; en auto, après une
  proposition. Caméra demandée en 1920 × 1080 idéal, résolution non garantie.
  Pixels transférés au worker,
  pas envoyés au serveur ; aperçu et fichier local libérés après analyse.
  Arrêt/onglet masqué/page quittée : caméra arrêtée et worker détruit.
- Photo <=5 MP, fichier <=12 Mio. Le changement de langue détruit le worker
  précédent. Analyse limitée à 60 s et annulable. Pas de cache persistant des
  photos, d'envoi de télémétrie ni de repli silencieux vers l'ancien serveur.

## Résultats vérifiés, pas une précision générale

- Banc AUTO 3 multilingue : **36/36 essais conformes**, sans modifier le moteur,
  les seuils ni l'index. Six références connues FR/EN/JP × trois mises en scène
  synthétiques (portrait, paysage, perspective) = 18 bonnes cartes en tête.
  Trois références exclues vérifiées absentes de l'index × trois mises en scène
  = neuf refus ; trois fonds unis × trois langues = neuf refus supplémentaires.
  Aucune ambiguïté selon le critère actuel du moteur parmi ces positifs.
  Ce n'est ni 36 cartes indépendantes, ni un taux de fiabilité en caméra réelle :
  les positifs utilisent des images numériques déjà connues de l'index.
  Temps Windows/Node non assimilables à ceux de l'iPhone. Rapport complet,
  URLs réellement utilisées et empreintes du code/index : [auto3-report.json](auto3-report.json).
  Reproduire : `npm run phone:benchmark:auto3` (réseau pour références publiques,
  Python local uniquement pour décoder, pixels non conservés).

### Test terrain confirmé (sans agrandir le catalogue)

15 octobre : l'utilisateur confirme les quatre cartes ci-dessous reconnues et
aucun résultat pour Badge. Validation de ces scénarios sur son iPhone 14 Pro,
pas une mesure de précision sur tout le catalogue.

Sur iPhone, sélectionner la langue correspondante, conserver AUTO 3 et scanner
les images ouvertes sur l'ordinateur : Tortank ex FR sv03.5-009, Butterfree V EN
swsh3-1, Butterfree VMAX EN swsh3-2, Florizarre ex JP SV2a-003. Deux essais par
carte : bien droite puis légèrement inclinée. Vérifier l'identité exacte et le
temps moteur, sans comparer ce dernier au délai caméra total. En FR, Badge
XY209 est volontairement absent : aucune proposition ne doit être présentée.
Un résultat « inconnu » est attendu, pas un bug. Vérifier aussi plusieurs essais
enchaînés pour chauffe/ralentissements. Pas de photos utilisateur à téléverser.

### Historique

- Retour terrain AUTO 3, 10 octobre : utilisateur iPhone 14 Pro indique que
  cela fonctionne parfaitement ; capture Safari iOS 18.6.2 affichant Pikachu
  JP 001/SV-P. Chargement 2387 ms. Deux tentatives automatiques enregistrées :
  1010 ms moteur / 1015 ms total (cadre puis image complète), puis 477 / 478 ms
  (zone cadrée). La capture montre le résultat final, pas le résultat individuel
  de chaque tentative ; ne pas conclure que les deux étaient concluantes.
  « Total » ne comprend pas l'attente avant la première capture ni les pauses
  entre essais. Ce retour valide ce scénario, pas tout le catalogue.

- AUTO 3 : utilisateur signale auto toujours en échec et manuel environ une
  fois sur dix sous AUTO 2. Cadrage corrigé ; 108 tests Node réussis. Le vrai
  moteur retrouve Pikachu sur neuf essais de caméra synthétique (photo fournie
  placée dans le cadre, deux orientations et petit décalage), 628–693 ms dans
  le dernier passage Windows/Node. Ce banc ne reproduit pas l'échec manuel
  iPhone et ne prouve pas que la régression est résolue sur téléphone.
  `node phone/check-framing.mjs "C:\\chemin\\photo-pikachu.jpg"`.
  Note de diagnostic : premiers essais de ce banc invalides car lecture d'un
  ROI non contigu ; copie contiguë et assertions d'égalité des pixels ajoutées.
  Ce défaut du banc n'existait pas dans la capture navigateur (Canvas).
  Version AUTO 3 servie sur le tunnel, HTTP 200 et fichiers vérifiés.

- Historique AUTO 2, remplacé : chargement ~2700 ms et analyse manuelle ~500 ms sur
  iPhone 14 Pro, mais capture automatique bloquée sur « Stabilise la carte »
  puis pause à 20 s. Défaut reproduit localement avec la photo Pikachu : ajout
  de +6 niveaux de luminosité alternés ou décalage d'un pixel à 64 × 88 empêche
  l'ancienne règle de déclencher. AUTO 2 compense une variation de luminosité
  modérée et un décalage de ±1 pixel, avec limites sur les changements bruts.
  Détails mesurés sur les deux axes, seuil 4 ; contraste minimum 18 ; différence
  résiduelle maximum 6. Les trois séries (fixe, lumière, décalage) déclenchent
  maintenant ; cela ne constitue pas encore une validation caméra iPhone.
  Diagnostic local, progression et bouton de relance ajoutés. Aucun pixel
  transmis ou enregistré. Reproduction : `node phone/check-stability.mjs
  "C:\\chemin\\photo-pikachu.jpg"`. 106 tests Node passent, y compris grandes
  variations refusées, pause/relance et erreur de lecture des pixels.

- 10 octobre : 102 tests Node passent, dont cadrage portrait/paysage,
  stabilité/mouvement/fond uni, déclenchement unique, arrêt caméra, annulation
  en arrière-plan et permission tardive. Caméra/worker simulés pour ces tests
  de cycle de vie. Chargement réel du nouveau labo via HTTPS vérifié dans
  Chromium (2890 ms / FR 667). Le nouveau déclenchement automatique et son
  cadrage physique restent à valider sur Safari/iPhone.

- Photo utilisateur de Pikachu JP 001/SV-P : bonne carte seule en premier
  **746 ms dans Chromium sur Windows**, aller-retour worker 748 ms.
  Chargement local 1132 ms ; pas une mesure réseau mobile ni Safari/iPhone.
  Copie de la photo non enregistrée dans le dépôt.
- Même moteur dans Node/WASM : trois lectures 836/740/744 ms, même carte,
  227 correspondances géométriques ; blanc refusé. [Rapport](node-report.json).
- Six références publiques FR/EN/JP : six bonnes cartes en premier, 669–760 ms.
  Trois références connues absentes : trois refus. [Rapport](reference-report.json).
  Images numériques déjà utilisées dans des essais antérieurs, pas un lot
  indépendant de photographies. Aucun chiffre de fiabilité extrapolé.
- 93 tests Node et sept tests Python passent (réseau localhost autorisé).
  Le lien HTTPS a été ouvert et son chargement vérifié.
- Retour utilisateur sur **iPhone 14 Pro / Safari iOS 18.6.2**, ancien mode
  capture manuelle : Pikachu JP 001/SV-P reconnu ; chargement 2502 ms, cinq
  analyses 550/526/499/487/491 ms (moyenne 510,6 ms), aucun ralentissement ni
  chauffe ressentis. Capture d'écran fournie, pas une mesure instrumentée de
  mémoire/batterie. Ces résultats ne valident pas encore le nouveau mode auto,
  d'autres cartes ni les téléphones moins puissants.

## Poids et sécurité

Index de 2 000 cartes inchangé : FR 667, EN 667, JP 666. Un seul lot chargé
par session : environ **21,7 Mo** non compressés. Runtime distribué : **12,8 Mo**.
Depuis CACHE 1 (15 octobre), premier transfert moteur + une langue environ
**17,6 Mo en Brotli** (18,9 Mo en gzip), contre 34,5 Mo non compressés.
Compression sans perte ; moteur, seuils et index inchangés.
WebAssembly réserve **128 Mio**, qui ne représentent pas la mémoire totale
(index, JSON, pixels et navigateur s'ajoutent). Valider sur l'iPhone réel avant
d'élargir l'index ; ne pas télécharger le catalogue complet d'un bloc.

### CACHE 1 — chargement versionné et cache local

- Manifest frais à chaque chargement ; fichiers nommés par SHA-256. Code moteur
  servi avec cache HTTP privé immutable ; index conservé explicitement dans
  CacheStorage, une version par langue, taille et SHA-256 vérifiés à chaque lecture.
- Index corrompu : téléchargement neuf. Cache refusé ou quota atteint : analyse
  toujours possible après téléchargement, avec indication visible. Aucune photo
  ni aucun flux caméra ne passe dans ce cache ; aucune télémétrie ajoutée.
- Le cache contient le JSON décompressé (~21,7 Mo par langue, ~65 Mo pour les
  trois), pas seulement les 14,5 Mo transférés. La mémoire WASM reste inchangée.
- Cache lié à l'origine : un nouveau nom de tunnel exige un nouveau téléchargement.
  Le navigateur peut l'effacer. Ce n'est pas un mode hors ligne : page et manifest
  nécessitent encore le réseau, aucun service worker n'est installé.
- Serveur de test : Brotli/gzip négociés, authentification avant toute réponse,
  seules les versions du manifest sont servies ; erreurs et manifest non cachés.
  Au déploiement statique Cloudflare, configurer compression et en-têtes équivalents.
- 115 tests Node réussis, dont sept tests cache/versions/corruption/quota et HTTP.
  Vérification HTTPS réelle Chromium/Windows : FR réseau 1692 ms, puis après
  rechargement FR « cache local vérifié » 1229 ms. Deux observations, pas un
  benchmark Safari ni une promesse de gain identique sur iPhone.

Test iPhone à faire : charger une langue, noter le temps, recharger la même
adresse, reprendre la même langue et charger à nouveau. Attendu : « cache local
vérifié », aucune nouvelle récupération de l'index. Comparer les deux temps et
rescanner une carte connue. Garder le même lien de tunnel pour cette comparaison.

Paquet figé `@techstark/opencv-js@4.12.0-release.1`, empaquetage tiers d'OpenCV,
licence Apache-2.0 fournie dans `dist/OpenCV-LICENSE.txt`. Sources :
[OpenCV.js](https://docs.opencv.org/4.12.0/d0/d84/tutorial_js_usage.html),
[paquet TechStark](https://github.com/TechStark/opencv-js).
SHA-256 amont contrôlé par le build :
`bd0c3e6448043de04f6a64a12cb7b759f78c3ab8f7c35c9f2e0f71c88bb17103`.

Cette distribution utilise des fabriques JavaScript Emscripten dynamiques.
Le build matérialise à l'avance leurs 3 207 fonctions ; le navigateur fait
uniquement une sélection dans ce code statique, sans compiler de chaînes.
Une fabrique imprévue provoque un refus, jamais un repli vers `eval`.
CSP conservée sans `unsafe-eval`, permission `wasm-unsafe-eval` seulement.
SHA-256 livré : `058b09f2b9a5ccf83dbf15f8844d55f6f2b6789036c58aa5689dcc3730578193`.
Cette adaptation est expérimentale ; une compilation OpenCV sans exécution
dynamique et plus petite reste préférable pour une distribution de production.

Le serveur de prévisualisation ne sert qu'une liste fermée de fichiers statiques,
exige un lien secret et refuse tous les uploads. Pas d'accès au workspace,
d'endpoint de reconnaissance ou de proxy d'images. Aucun fichier utilisateur
n'est inclus dans `dist/`. Ne pas partager publiquement le lien de test.

## Reproduire

Depuis `scanner-web` :

```powershell
npm ci --ignore-scripts
npm run phone:build
npm run phone:preview
```

Le serveur local affiche un lien protégé, port 8791. Il est **uniquement un
serveur de développement**, pas l'architecture de production. Un tunnel HTTPS
temporaire autorisé peut servir ces fichiers à l'iPhone ; tant que ce mode est
utilisé, le PC doit rester allumé pour les télécharger, mais ne fait pas leur
analyse. Après hébergement statique, le PC ne sera plus dans le parcours.

Essais reproductibles facultatifs :

```powershell
npm run phone:benchmark -- "--photo=C:\chemin\photo-pikachu.jpg"
node phone/benchmark-references.mjs
```

Ces deux bancs utilisent Python seulement pour décoder les images de test dans
Node, **pas pour reconnaître**. Le navigateur décode lui-même les images et ne
requiert aucune installation Python. Rapports textuels remplacés à chaque essai.

Prochain jalon : vérifier CACHE 1 sur Safari/iPhone, puis élargir les essais
physiques/inconnus et mémoire/batterie. Ensuite : alléger davantage le runtime
et les index, évaluer OCR spécialisé compatible navigateur et intégrer à l'UI.
