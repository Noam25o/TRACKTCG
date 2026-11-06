# Prototype de reconnaissance visuelle sur PC — état au 7 octobre 2026

Changement autorisé par l’utilisateur : une capture de la carte peut transiter
par le lien Cloudflare protégé vers son PC Windows. Pas d’API d’IA tierce,
galerie ou conservation des photos. Flux vidéo non envoyé ; seul le JPEG issu
du cadre est envoyé après « Analyser la carte ». L’aperçu reste vivant pendant
l’analyse, pas besoin de maintenir la position après le clic. Retour de jusqu’à
trois candidats, confirmation d’impression toujours obligatoire. Pas encore de
file de scans multiples comme Collectr ni de capture automatique après cadrage.

## Moteur et limites

Essai séparé de lecture des numéros : [banc OCR CPU](OCR_CPU.md). Les dépendances
PaddleOCR sont dans un autre environnement ; elles ne sont pas chargées par
le serveur ORB ni distribuées au navigateur. Contrainte de production : téléphone
et Cloudflare, Firebase facultatif pour comptes/données ; aucun VPS, serveur de
reconnaissance dédié ou PC permanent. Le portage navigateur reste à vérifier
sur Safari/iPhone ; ce service Python est seulement un outil de prototype.

### Parcours sans saisie et expérimentation locale — 7 octobre 2026

Aucune saisie dans le scan. Le serveur normal et le tunnel gardent la recherche
visuelle rapide, **sans vérification OCR du numéro activée**. L’expérimentation
suivante est réservée au diagnostic local `--ocr-check`, hors tunnel.
`Engine.recognize(..., with_verification=True)` prépare un bandeau uniquement
si le premier candidat a moins de 80 inliers ou si le second score atteint
65 % du premier. Ce seuil plus large que `ambiguous` sert à déclencher une
vérification, pas à calibrer une probabilité. Les résultats forts restent rapides.

Homographie référence→capture normalisée inversée, composée avec la transformée
capture originale→normalisée, puis appliquée aux pixels haute résolution de
la capture. Carte redressée 900 × 1260, bandeau inférieur 900 × 252 PNG couleur
sans perte ≤700 ko. Pas de seconde compression JPEG des petits caractères.
Retour temporaire de ce bandeau au navigateur dans la même réponse ; OCR eng
local automatique (8 s maximum), contexte large à 1500 puis 1000 px, troisième
passe en traits sombres si nécessaire. Deux lectures concordantes de confiance
≥55 requises, conflit refusé ; arrêt dès accord. Pas de zoom serré depuis une
boîte TSV ni de caractères forcés. Aucun texte substitué depuis les métadonnées ou
illustrations de référence. Pas de photo stockée après résultat, annulation
navigation/arrière-plan et réponses tardives ignorées. Les données image sont
retirées du résultat avant passage à l’UI. Libération mémoire, pas garantie forensic.

Numéro compatible : réordonne sans supprimer les candidats, confirmation
humaine de la carte/finition toujours requise. Numéro partagé, absent ou en
conflit : doute/recadrage explicites, sans formulaire. Dénominateur numérique
non utilisé comme extension ; seuls les codes promos explicites sont associés
au code catalogue. OCR des logos/alias généraux encore non implémenté.

Le diagnostic local `/visual-check` force le contrôle OCR par `verify=1` pour
tester son vrai parcours même sur des candidats forts. Ce forçage est ignoré
sur le serveur normal/tunnel ; il n’est pas une mesure de fréquence OCR réelle.

Validation du 7 octobre : 86 tests web et cinq tests Python passent, syntaxe OK.
Après correction, les onze références publiques dégradées restent premières.
Trois numéros confirmés, huit refus :

| Référence | Lecture confirmée | OCR + démarrage sur PC |
| --- | --- | --- |
| FR base1-14 Raichu | 14/102 | 1 031 ms |
| EN swsh3-20 Charizard VMAX | 020/189 | 1 303 ms |
| JP SV2a-003 Florizarre ex | 003/165 | 1 489 ms |
| FR base1-1 Alakazam | Refus | 1 029 ms |
| EN swsh3-1 Butterfree V | Refus | 1 708 ms |
| JP SV-P-001 Pikachu | Refus | 1 803 ms |
| FR sv03.5-009 Tortank ex | Refus | 1 716 ms |
| EN swsh3-2 Butterfree VMAX | Refus | 1 915 ms |
| JP SV2a-006 Dracaufeu ex | Refus | 1 546 ms |
| JP SV-P-010 Poké Ball | Refus | 852 ms |
| FR sv03.5-006 Dracaufeu ex | Refus | 1 589 ms |

Mesures navigateur PC, OCR forcé ; modèle déjà en cache, hors capture/réseau
et moteur visuel. Canvas 900 × 1257, rotation 0,018 rad, flou 0,4 px, JPEG 0,82.
Le même lot a servi à ajuster le lecteur : pas de précision indépendante ni de
preuve sur iPhone. Les erreurs et variations suivant le prétraitement restent
importantes ; PNG gris/interpolation cubique non retenus. Cinq passes ont aussi
été essayées sans gain sur les cas difficiles observés : trois maximum gardées.
Le diagnostic propose ces onze exemples et une comparaison de six découpes
optionnelle, qui ne valide jamais un numéro ni ne modifie le classement.

Ne pas activer ce module sur le lien public à ce stade. Prochaine étape :
captures originales iPhone, lot indépendant et contrôles négatifs, puis mesure
de l’apport réel dans les cas visuellement ambigus. Pas d’index reconstruit ni
d’images de collection persistées.

#### Photo fournie par l’utilisateur — Pikachu JP 001/SV-P

Fichier JPEG 1492 × 2048, 624 780 octets, trame périodique visible. Analyse
locale depuis le fichier temporaire fourni, sans copie de la photo dans le
projet ni envoi à un service IA. Le diagnostic accepte maintenant un JPEG
volontaire (≤3 Mio / 5 mégapixels), en résolution originale ou réduit à
900 × 1257 JPEG 0,9, sans dégradation synthétique supplémentaire. La sélection
de référence ne fournit que la langue ; aucun nom/numéro attendu au moteur.

- Réduction 900 × 1257 : bonne carte JP SV-P-001 première, moteur 352 ms ;
  lecture du numéro refusée, OCR+démarrage 1 366 ms.
- Original 1492 × 2048 : même bonne carte première, moteur 244 ms ; lecture
  du numéro refusée, OCR+démarrage 1 434 ms.

Le bandeau rectifié reste 900 × 252 dans les deux cas. Ces deux essais ne
mesurent donc pas un OCR à pleine résolution et n’isolent pas l’effet du moiré.
Ils confirment que la référence est présente et que l’identification visuelle
fonctionne sur cette photo, sans prouver la lecture des caractères imprimés.
Le code 001/SV-P affiché dans le résultat provient du catalogue, pas de l’OCR.
Le lecteur ne doit pas recevoir ce code pour fabriquer une confirmation.
Prochaine investigation : localisation de texte blanc/contour noir dans le
bas de la capture originale, puis lecture séparée de la zone numéro/promo.
L’image reste seulement dans la mémoire de la page de diagnostic jusqu’à sa
fermeture ; le fichier joint d’origine est laissé intact. Tunnel inchangé.

### Historique remplacé — affinage local facultatif du numéro

Le moteur visuel et son index restent inchangés. Après les résultats, un panneau
replié propose une lecture Tesseract locale du bas de la capture ou une saisie
manuelle numéro/code d’extension. Deux découpes de la même image doivent donner
la même fraction/promo, avec mots suffisamment confiants. Les nombres isolés
ne sont pas acceptés en OCR, afin de ne pas lire des PV ou un copyright comme
un numéro. Pas de correction O/0 ni déduction d’extension depuis le dénominateur.
Les candidats compatibles remontent, aucun candidat n’est supprimé et aucune
impression/finition n’est validée automatiquement. Les codes promos explicites
SV-P/S-P/SM-P sont utilisables ; alias généraux d’extension encore non intégrés.

Capture JPEG du téléphone en RAM aux résultats pendant deux minutes maximum,
puis références libérées ; navigation/arrière-plan/nouveau scan/fermeture
annulent la lecture et libèrent la capture immédiatement. Le modèle eng local
sert pour les chiffres et codes latins des trois langues. Aucun nouvel upload
d’image, enregistrement ou changement de l’index. Premier démarrage OCR plus
long ; le scan visuel rapide ne l’attend pas.

Contrôle navigateur sur références publiques légèrement tournées/floutées,
canvas JPEG 900 × 1257 (dimensions de capture du scanner) : Raichu FR base1-14
→ `14/102`, Charizard VMAX EN swsh3-20 → `020/189`. Pikachu JP SV-P-001 retrouvé
visuellement mais numéro refusé par l’OCR ; saisie `001/SV-P` reconnue compatible.
Un premier essai Raichu réduit à 450 × 630 n’avait pas lu le numéro avec assez
de certitude. Conflit manuel `99/102` correctement signalé, carte conservée.
Expiration de capture visible, lecture désactivée, saisie encore disponible.
80 tests web et quatre tests Python passent, syntaxe vérifiée ; pas de caméra
PC activée ni validation sur photos iPhone indépendantes. Le diagnostic partage
les composants réels ; son texte OCR est affiché uniquement pour ces références
publiques, sur la route locale inaccessible en tunnel.

### Reconnaissance visuelle

OpenCV ORB + appariement Hamming + vérification d’homographie RANSAC.
Détection d’un contour quadrilatère et redressement quand possible ; repli sur
le cadre fourni sinon. Recherche dans toutes les empreintes indexées de la
langue choisie, sans lecture du nom, ni recherche réseau de candidats au scan.
Préfiltre pHash des 80 voisins, puis verification géométrique. Pas de modèle
neural entraîné, de probabilité calibrée ou de promesse de précision.

Méthodes documentées par [OpenCV](https://docs.opencv.org/4.x/d1/d89/tutorial_py_orb.html)
et son [tutoriel de vérification géométrique](https://docs.opencv.org/4.x/d1/de0/tutorial_py_feature_homography.html).
L’application open source [The Tin](https://github.com/the-tin-app/the_tin)
utilise aussi un pack d’empreintes ORB ; aucun code de cette application AGPL
n’a été copié. Ce n’est pas le moteur de Collectr ou de PokéItem, ni une preuve
de performances équivalentes. Pokeum a une architecture pertinente, mais son
modèle annoncé n’est pas disponible dans ses Releases lors de la vérification.
Les réseaux spécialisés restent à comparer à cette base classique.

Lot initial volontairement partiel : numéros 1–60 du Set de Base FR/EN,
151 FR/JP, Ténèbres Embrasées EN et promos SV-P JP quand les sources existent.
Des références supplémentaires du premier tri sont conservées. Images absentes
refusées, pas remplacées par une impression proche. L’état réel des comptes
par langue est renvoyé par `/api/visual/status`. Le catalogue affichable est
beaucoup plus grand que cet index : une carte consultable n’est pas forcément
reconnaissable par ce prototype. Continuer à élargir après essais sur téléphone.

Les réimpressions, sleeves, reflets, blur, fortes perspectives, cartes absentes
et le préfiltre peuvent faire échouer la recherche. La langue reste un choix
explicite ; OCR numéro/extension et détection automatique de langue restent à
intégrer. Aucune finition holo/reverse ni état déduit automatiquement.

## Résultats du 7 octobre — échantillon synthétique, pas précision iPhone

Index : **2 000 références (FR 667, EN 667, JP 666)**, 65 399 947 octets
d’empreintes/métadonnées. Sauvegarde du pilote de 411 conservée. Treize sources
absentes/inexploitables signalées dans la dernière exécution de construction ;
elles ne sont pas remplacées par une autre impression. Aucune image stockée.

18 cartes × trois vues = 54 requêtes positives : bonne référence première dans
54/54 cas avec l’index original et 54/54 avec le WebP Q50 de la référence testée.
Médiane/p95 moteur original : **157/250 ms**, WebP : 156/219 ms. Les six cartes
déjà présentes dans le pilote permettent une comparaison à requêtes identiques :
411 références, 140/236 ms ; 2 000 références, 142/329 ms (18 requêtes chacune).
Mesures PC uniquement, hors capture, réseau et chargement des résultats ; durée
variable selon charge. Ne pas assimiler WebP à une accélération démontrée.

Images sources de cet échantillon : 7 515 426 octets ; WebP Q50 : 1 038 182 octets,
soit environ −86 %. Résolution d’origine conservée, tailles non uniformes. Le
test ne remplace qu’une empreinte cible à la fois ; il ne démontre pas le rappel
d’un index entièrement compressé. Aucun transfert R2/conversion générale engagé.

Neuf cartes absentes × trois vues : un faux positif au premier passage, sur
JP SV11W-172 associée à SV2a-040 avec seulement 12 points. Rapport initial gardé
dans `data/benchmark-before-stricter-match.json`. Seuil minimum relevé à **24
points géométriques** ; rapport final `data/benchmark-report.json` : 27/27 refus,
aucun échec de téléchargement/exécution. Le même lot a servi à l’ajustement :
ce zéro n’est pas une estimation indépendante du taux de faux positifs.
Vérifier la perte éventuelle de rappel sur captures téléphone difficiles.

75 tests web et trois tests Python réussis. Contrôle navigateur à 390 px :
Raichu FR base1-14, Charizard VMAX EN swsh3-20 et Pikachu JP SV-P-001 retrouvés
en premier via le vrai POST et le worker PC. Alternative Raichu dépliée et
sélectionnée explicitement dans le diagnostic, sans ajout à la collection.
Lien HTTPS protégé vérifié avec l’index de 2 000 ; caméra PC non activée.
La présentation partage le même
composant entre scanner et diagnostic : candidat principal puis alternatives
repliables, ouvertes si ambiguïté. Les choix restent explicites. Validation
indépendante sur iPhone/cartes physiques, réimpressions, reflets et sleeves à
poursuivre ; le catalogue reste nettement plus large que l’index de détection.

## Installation et index

### Comparaison des formats TCGdex — 7 octobre 2026

Commande : `npm run visual:benchmark:sizes`. Fichiers servis réellement par
TCGdex, sans recompression : `high.png`, `high.webp`, `low.webp` sur le même
chemin de carte. Douze cartes, quatre par langue : Set de Base FR/EN et SV2a
JP uniquement. Trois requêtes synthétiques issues du PNG high par carte,
identiques pour chaque format ; seule l’empreinte cible change temporairement
en RAM parmi les 2 000. Ordre des trois formats alterné entre cartes.

| Référence | Taille totale des 12 images | Moyenne/image | Bonne carte première | Médiane moteur |
| --- | ---: | ---: | ---: | ---: |
| high.png | 4 319 210 octets | 360 ko | 36/36 | 165 ms |
| high.webp | 976 676 octets | 81 ko | 36/36 | 173 ms |
| low.webp | 241 958 octets | 20 ko | 36/36 | 170 ms |

Le low.webp pèse 75 % de moins que le high.webp sur ce lot. Pas d’accélération
moteur démontrée : le moteur normalise toujours l’image avant d’en extraire les
empreintes, puis compare ces empreintes déjà chargées en mémoire. Ce test ne
mesure pas le temps réseau. Les points géométriques du bon premier résultat
diminuent en médiane de 456 (high.webp) à 402 (low.webp), sans erreur ici.

Ce petit lot issu de deux extensions et de requêtes dérivées des références ne
valide ni un index tout-low, ni les faux positifs, ni la robustesse aux photos
iPhone/reflets/réimpressions. Aucun seuil n’a été ajusté pendant cette comparaison.
Garder les références actuelles pour la reconnaissance ; low.webp est une piste
pour les vignettes et un futur index allégé à valider sur des scans indépendants.

Rapport : `data/benchmark-sizes-report.json`, avec URL, octets, dimensions décodées,
SHA-256, résultats par carte et par vue. Aucun fichier image enregistré. SHA-256
de l’index identique avant/après ; pas de migration, changement serveur ou tunnel.
Quatre tests Python passent, dont restauration en mémoire de l’entrée originale
après succès et après erreur du benchmark ; contrôle de syntaxe réussi.

### Construction et benchmark de compression

Extension reproductible du pilote : `npm run visual:build:2000`. La commande
vise 667 FR, 667 EN et 666 JP, en conservant les références déjà présentes.
Elle parcourt les extensions à tour de rôle, réserve neuf cartes absentes pour
les contrôles, télécharge au maximum quatre images simultanément et calcule
les empreintes séquentiellement. Sauvegardes reprenables et copie préalable
`data/index-before-2000.json` ; rapport de la dernière exécution dans
`data/build-report.json` (les octets téléchargés concernent cette exécution,
pas les reprises antérieures). L’index reste partiel ; images manquantes et
erreurs de décodage signalées. Redémarrer le serveur après construction.

`npm run visual:benchmark` contrôle six références connues et douze nouvelles,
plus neuf cartes réservées hors index. Trois transformations synthétiques par
carte : frontal, perspective et nom masqué, avec flou léger/JPEG. Pour chaque
carte présente, sa référence est remplacée temporairement par une version WebP
qualité 50 ; les requêtes viennent toujours de l’original. Le reste de l’index
reste inchangé : ce n’est pas une conversion globale du corpus. Encodage OpenCV,
effort non configuré, donc pas une reproduction exacte des réglages Squoosh.
Le rapport `data/benchmark-report.json` contient résultats par cas, tailles,
latences moteur et empreintes SHA-256 de l’index et du moteur. Aucune image du
benchmark n’est enregistrée. Ce test de régression sur références publiques
ne mesure pas la précision réelle sur téléphone.

Environnement isolé `.tools/visual-env`, Python 3.13, OpenCV headless 4.12.0.88,
NumPy 2.2.6 depuis PyPI ; pas de modification du Python système.

```powershell
python -m venv .tools/visual-env
.\.tools\visual-env\Scripts\python.exe -m pip install --only-binary=:all: -r visual/requirements.txt
node visual/build.mjs
.\.tools\visual-env\Scripts\python.exe visual/test_engine.py
```

Références publiques chargées depuis les URL exactes TCGdex/Malie/TCGplayer JP,
sans redirects et avec limites. Images décodées en RAM ; seules métadonnées,
pHash, points et descripteurs sont écrits dans `visual/data/index.json` (ignoré
par Git, format versionné). Construction reprenable ; démarrer le moteur après
la construction pour charger le nouvel index. Les liens d’affichage restent
distants. Pas de corpus d’images sur disque, les illustrations gardent leurs
ayants droit. `--all` prépare un lot plus grand et doit être lancé volontairement
après estimation de durée, bande passante et taille d’index.

## Lancement

```powershell
$env:SCAN_VISUAL_PC='true'
node server.mjs --ocr-check
# ou après accord pour ouvrir le tunnel :
node share.mjs --allow-public-test --visual-pc
```

Sans option explicite, les uploads restent désactivés. Le seul POST autorisé
est `/api/visual/recognize?language=FR|EN|JP`, cookie à clé + Origin de cette
origine obligatoires, JPEG ≤3 Mio, décodage ≤5 millions de pixels, une tâche à
la fois, délai 20 s. Pas de photo dans les logs, fichiers ou index. La dernière
requête est libérée par le worker après traitement ; buffers réseau remis à
zéro côté Node. Cela n’est pas une garantie d’effacement forensic de la RAM.
Les photos transitent par Cloudflare : pas une liaison directe iPhone→PC.
Ce service Python sur PC n’est pas hébergé par Firebase/Cloudflare Workers.

Contrôle navigateur local `/visual-check` après ouverture du lien à clé : images
publiques avec rotation et léger flou synthétiques, même route POST que le scan.
Route de diagnostic inaccessible en tunnel. Ce n’est pas un benchmark physique
iPhone. Le test de cycles caméra utilise des pixels/DOM simulés, pas une caméra.
Le retour utilisateur sur téléphone doit décider de la suite avant généralisation.

Validation locale du 3 octobre : 74 tests web, trois tests Python (dont
préservation UTF-8 des noms via les pipes Windows) et syntaxe réussis.
Dans le navigateur, cinq images publiques avec rotation/flou synthétiques
retrouvent leur référence en première position : Raichu FR base1-14,
Dracaufeu-ex FR sv03.5-006, Charizard VMAX EN swsh3-20, Pikachu JP SV-P-001
et リザードンex JP SV2a-006. Traitement moteur seul observé à environ
0,2–0,6 s sur ce PC ; hors capture, réseau, chargement d’images/fiches.
Images issues des mêmes sources que l’index : ces essais ne mesurent ni
généralisation aux photos réelles ni taux de faux positifs ou précision.

Retour utilisateur du 5 octobre sur images affichées sur ordinateur : bonne
référence retrouvée pour Alakazam FR base1-1 (environ 1 s), Tortank-ex FR
sv03.5-009, Butterfree V/VMAX EN swsh3-1/2, Florizarre ex JP SV2a-003 et
Poké Ball JP SV-P-010 (quasi instantané rapporté). Inclinaisons et nom masqué
tolérés dans les essais signalés ; plusieurs propositions pour Alakazam et
Florizarre ex. Nombre de tentatives et rangs exacts inconnus, aucun temps
instrumenté. Photos d’écran de sources indexées, pas de benchmark physique
indépendant. À cette date, l’UI affichait tous les candidats retournés (maximum
trois), même si le champ `ambiguous` est faux ; ce comportement explique que
plusieurs propositions ne signifient pas nécessairement des scores proches.
