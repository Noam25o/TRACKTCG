# TRACKTCG — V1 web mobile, catalogue, scanner et collection

Version mobile web **séparée de l'application Expo**, désormais base de la V1.
Version native facultative à décider après que
le produit web fonctionne. Le prototype permet de tester le scan sur
iPhone sans Mac ni compte Apple Developer payant. Node.js 22+ ; `npm ci --ignore-scripts`
installe l’OCR et les modèles figés. Pas de build natif.

## État réel

### 9 octobre 2026 — Labo sans serveur de reconnaissance

[Essai téléphone](phone/README.md) : ORB dans un worker WebAssembly et fichiers
statiques uniquement. `npm run phone:build` puis `npm run phone:preview`.
Test navigateur PC réussi, validation iPhone encore nécessaire. Scanner
habituel inchangé ; aucun backend de calcul requis par cette page séparée.

### 7 octobre 2026 — Banc OCR CPU isolé

Comparaison PP-OCRv5 / Tesseract dans un environnement dédié, sans GPU et sans
changement du scanner public. [Protocole et résultats](visual/OCR_CPU.md).
Le PC reste réservé au prototype. En production : téléphone + Cloudflare,
Firebase facultatif pour comptes/données, aucun VPS ni serveur de reconnaissance
dédié. Prochain jalon : faisabilité navigateur et mesures sur Safari/iPhone,
pas hébergement du moteur Python sur une autre machine.

### 7 octobre 2026 — Parcours automatique sans saisie

Le formulaire d’affinage et son bouton OCR sont retirés. Le lien public garde
capture → recherche visuelle rapide → résultat à confirmer, sans OCR du numéro.
La suite ci-dessous est **expérimentale, réservée au diagnostic local** : si le
meilleur candidat a moins de 80 points géométriques ou que le second atteint
65 % de son score, le PC prépare le bas de la capture pour l’OCR. Ces seuils
sont expérimentaux, pas des probabilités de reconnaissance exacte.

La transformation RANSAC référence→capture est inversée puis composée avec la
normalisation pour redresser les pixels ORIGINAUX en 900 × 1260. Seul le bas
900 × 252 est encodé temporairement en PNG couleur sans perte (≤700 ko) et renvoyé au téléphone.
Aucun pixel du catalogue ne sert à lire le numéro. L’OCR eng local démarre seul,
lecture générale à 1500 px, bandeau inférieur à 1000 px puis extraction des
traits sombres si nécessaire. Le zoom serré et la liste de caractères forcée
sont retirés. Trois passes maximum, arrêt dès deux lectures concordantes ou
conflit. Pas de baisse du seuil OCR (55), aucun numéro attendu fourni au lecteur.

Budget OCR de huit secondes, premier chargement possiblement plus lent : à
l’expiration, recadrage/confirmation visuelle proposés, pas de saisie. Numéro
incompatible ou partagé entre plusieurs propositions : doute explicite,
candidats conservés, aucun ajout automatique. Une fraction numérique n’identifie
pas l’extension ; promos explicites reconnues, alias/symboles généraux à intégrer.
Le bandeau et la capture sont libérés après analyse/annulation, sans conservation
de deux minutes aux résultats. Aucun corpus/bucket/backend ajouté.

Validation navigateur élargie : onze références publiques dégradées, onze bons
premiers résultats visuels ; trois numéros confirmés (Raichu FR 14/102,
Charizard VMAX EN 020/189, Florizarre ex JP 003/165), huit refus. OCR et démarrage
sur ce PC : 0,85–1,92 s sur ce lot, hors réseau/capture et sans garantie iPhone.
Pikachu JP 001/SV-P reste refusé. Les mêmes exemples ont servi au réglage : ce
n’est pas un taux de précision indépendant. OCR toujours local expérimental,
désactivé sur le lien public. 86 tests web, cinq Python et syntaxe réussis.
Le diagnostic propose les onze cartes et une comparaison de découpes facultative
qui ne modifie jamais le classement. Une vraie capture iPhone est nécessaire
pour la validation suivante ; aucun corpus ni index modifié.

### Historique remplacé — affinage facultatif du numéro

Après les propositions visuelles, ouvrir « Affiner le numéro / l’extension ».
« Lire le numéro » utilise Tesseract local, modèle anglais pour les chiffres et
codes latins, sur deux découpes du bas de la même capture. Premier chargement
plus long ; le scan visuel n’attend jamais cet OCR. Lecture concordante et mots
de confiance suffisante requis, sinon saisie manuelle. Pas de correction O→0.

Numéros préfixés et promos pris en charge (`GG01`, `001/SV-P`), zéros initiaux
normalisés. Le dénominateur numérique (`14/102`) n’identifie pas une extension.
Hors code promo explicite, le code d’extension se saisit volontairement et doit
correspondre à celui de la proposition ; pas de correspondance automatique
entre abréviations imprimées et identifiants catalogue. Classement seulement :
tous les candidats sont conservés, aucun choix ni ajout automatique.

La capture JPEG reste temporairement en RAM du téléphone aux résultats,
deux minutes maximum pour cette lecture facultative. Libération à l’expiration,
au nouveau scan, à la navigation, à l’arrière-plan ou à la fermeture ; worker
OCR interrompu, réponses tardives ignorées. Aucun nouveau POST d’image, fichier,
IndexedDB ou galerie. L’analyse visuelle PC initiale reste inchangée.
80 tests web, quatre tests Python et syntaxe réussis ; lecture physique iPhone
à valider. Index 2 000 et références haute résolution inchangés.

### 7 octobre 2026 — index visuel élargi et propositions hiérarchisées

Le mode **Reconnaissance visuelle · PC** devient le choix de test lorsque le
serveur est lancé explicitement avec `npm run share:visual` (ou `SCAN_VISUAL_PC=true`).
Carte entière → « Analyser la carte » → jusqu’à trois propositions à confirmer.
L’aperçu reste actif pendant l’analyse ; pas de lecture du nom obligatoire,
donc pas de blocage préalable sur ex/VMAX ou kana. Pas encore de capture
automatique ni de file de scans multiples. L’ancien OCR et le lot manuel restent
disponibles ; les sections OCR ci-dessous décrivent **ces anciens modes uniquement**.

Avec l’accord utilisateur, seul le JPEG du cadre est envoyé via Cloudflare au PC
Windows pour OpenCV ORB + vérification géométrique RANSAC, sans API d’IA tierce.
Pas de flux vidéo envoyé, ni de photos écrites dans des fichiers/logs/index.
Images transitoires en mémoire, pas de garantie d’effacement forensic de la RAM.
Sans activation explicite du moteur, aucun upload n’est accepté. Authentification
par cookie à clé, Origin contrôlé, JPEG ≤3 Mio et décodage ≤5 millions de pixels.
Ce service PC Python n’est pas un backend déployé sur Cloudflare/Firebase.

Index partiel **2 000 références : FR 667, EN 667, JP 666**, environ 65,40 Mo
de métadonnées et empreintes, pas de fichiers d’images. Les 411 références du
pilote sont conservées ; ajouts répartis à tour de rôle entre extensions.
Construction reprenable : `npm run visual:build:2000`, puis redémarrer le serveur.
**Le catalogue est plus grand que cet index** : carte consultable ne signifie
pas carte reconnaissable. Une absence peut donc être un manque de référence,
pas une erreur de lecture. Langue explicite, impression/numéro à vérifier ;
aucune détection de holo/reverse ou d’état.

[Installation, méthode, confidentialité et limites](./visual/README.md).
75 tests web réussis et trois tests Python. Régression synthétique : 54/54 bons
premiers résultats avec les originaux comme avec les références WebP Q50 du
test ; médiane moteur PC 157 ms, p95 250 ms, hors capture/réseau/fiches.
Un faux positif initial sur 27 requêtes absentes a motivé un seuil de 24 points
géométriques, contre 12 auparavant ; les 27 sont refusées après ajustement sur
ce même lot. Ce n’est pas une validation indépendante ou une fiabilité iPhone.
Le candidat principal est mis en avant ; les alternatives sont dépliables,
ou ouvertes d’emblée si les scores sont proches. Aucune sélection automatique.

Interface allégée : recherche compacte et langues en boutons FR/EN/JP,
catalogue/collection en grilles visuelles, scanner central dans la navigation.
L'aide `?` regroupe les sources et limites ; dans Collection, le menu `…` et
« Stockage local » ouvrent les sauvegardes. Les avertissements complets restent
accessibles. Options d'un lot via `…` ; toucher une carte ouvre sa fiche.
Quantités par +/−, prix facultatif replié, vérification obligatoire conservée.
La refonte ne migre, n'efface ni ne réécrit les données de collection.

La navigation réunit Catalogue, Scanner et Collection. Catalogue TCGdex FR/EN/JP
paginé (24 fiches/page, garde-fou à 500 pages), nom français accepté pour les
Pokémon, recherche par numéro ou nom d'extension sans traduction. Le catalogue
reste limité à la couverture des sources et n'est pas une liste exhaustive garantie.
Fiches réelles et ajout après vérification de la langue, du numéro et de l'impression.
La finition commence « Non précisée » : elle n'est pas inférée du seul visuel.
Aucun fichier ou collection Expo supprimé ; aucune migration Expo automatique
ni import de son format n'est implémenté.

Collection locale IndexedDB, sans compte ni synchronisation Firebase : quantités,
langue, finition, état et coût unitaire facultatif en centimes ; ajout confirmé
seulement après la transaction. Lots identiques regroupés, retrait d'un exemplaire
après confirmation. Recherche française conservée dans les métadonnées des cartes
EN/JP ajoutées, même sans nouvelle requête. Fiches sauvegardées disponibles dans
la page déjà ouverte ; images et rechargement hors ligne non garantis.

**Exporter régulièrement et avant de changer de lien** : les données appartiennent
au navigateur et au domaine exact. Un nouveau domaine temporaire n'a pas accès
à l'ancien stockage. Effacer les données du site, changer de navigateur ou perdre
le stockage peut effacer la collection ; il n'y a pas encore de copie serveur.

Export JSON `tracktcg.web-collection` version 1, maximum 2 Mio / 5 000 lots.
Le fichier reste local et n'est pas envoyé au serveur. Import validé, aperçu puis
confirmation : seuls les identifiants absents sont ajoutés, les quantités des lots
existants ne sont jamais remplacées. Réimporter le même fichier est idempotent ;
deux identifiants distincts restent deux lots, même si leur carte est identique.
Ce n'est pas un import CSV ou Expo. Vérifier l'export dans Fichiers/Téléchargements.
Coût d'achat séparé des repères de marché disponibles dans les fiches.
Pas encore de total de valorisation : les quotes ne qualifient pas langue/état.

### Nouvel incrément — OCR automatique et prix

Mode par défaut : choisir FR/EN/JP, Scanner, carte entière droite dans le cadre.
Tesseract.js 7 / WASM lit le bandeau supérieur sur le téléphone, avec des modèles
spécialisés `fra`, `eng`, `jpn` servis localement, sans CDN ou API payante.
Deux lectures concordantes du nom figent le cadre utilisé pour la lecture, puis
déclenchent le chargement limité des références et la comparaison de cette image.
Le bouton « Figer et analyser » permet aussi de cadrer une seule fois avant OCR.
La caméra s’arrête dès la capture ; aucun maintien nécessaire pendant le réseau.
Un cliché unique n’est pas rejoué comme quatre images indépendantes : contrôle
qualité/distance/ambiguïté puis propositions à confirmer. Le mode manuel en
direct conserve ses quatre images stables et accepte aussi la capture explicite.
Aucun ajout sans confirmation. Capture uniquement RAM/canvas, jamais galerie,
IndexedDB, sauvegarde ou serveur ; effacement à l’arrêt, résultats, navigation,
arrière-plan ou nouvelle capture. « Recadrer » permet de réessayer après un échec.
Un nom lu n’est pas encore l’impression exacte. Recherche manuelle conservée.

Filtre des gros mots du titre pour éviter les légendes d’évolution. En JP, région
du titre recentrée hors PV, fragments kana regroupés par ligne, filtre de confiance
adapté (expérimental) sans inventer une correspondance approximative. Sur capture,
jusqu’à trois essais bornés : titre ciblé, extraction des traits sombres, bandeau
élargi en bloc. FR/EN : jusqu’à quatre lectures bornées (bandeau historique,
titre moderne ciblé, traits sombres, bandeau élargi), arrêt dès résolution.
Ces opérations suivent les recommandations de qualité/cadrage de Tesseract :
https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html
Noms limités
aux 1 025 espèces du dictionnaire ; dresseurs/énergies, noms multiples/stylisés et
certains noms composés exigent encore la recherche manuelle. Pas d’OCR du numéro
ni de redressement. Lot toujours limité à 72 fiches par nom ; images manquantes
toujours impossibles à comparer. Pas de téléchargement massif de références.

Premier scan plus long : worker + WASM + modèle de la langue. Modèles compressés
FR 0,71 Mo, EN 2,95 Mo, JP 2,03 Mo (unités décimales), en plus du moteur.
Cache des modèles dans une base indépendante de la collection ; stockage/hors
ligne non garantis. Le pont de messages v7 figé possède le worker et le termine
même pendant l’initialisation à l’arrêt/navigation/arrière-plan. Délais bornés
à 45 s à l’initialisation et 15 s par lecture. Seuils expérimentaux, pas un taux
de précision. Les frames sont temporaires ; aucun POST/upload accepté.

Prix via TCGdex : Cardmarket EUR (tendance, minimum, moyenne 30 j si fournis),
TCGplayer USD (market price, minimum, maximum si fournis), source et date source
conservées. Finitions distinguées, « brillante » Cardmarket ne sépare pas
fiablement holo/reverse. Langue/état non filtrés, certaines correspondances
erronées : [limites officielles](https://tcgdex.dev/fr/faq).
Pas de conversion de devise, correction d’état inventée, ni devis garanti pour
un exemplaire FR. Aucune substitution EN à une impression JP : source tarifaire
japonaise qualifiée encore manquante. Date inconnue/ancienne/incohérente indiquée,
prix absent jamais égal à zéro. Actualisation dans la fiche, indépendante de
l’ajout ; les prix ne sont pas persistés ou importés comme une vérité de collection.

Provenance/empreintes : [ocr-provenance.json](./ocr-provenance.json), notices
dans `/ocr-notices.txt`. CSP : `wasm-unsafe-eval` pour le WASM uniquement, workers
de cette origine, sans `unsafe-eval`, `unsafe-inline` ou CDN externe.
71 tests locaux réussis, dont OCR/caméra synthétiques et prix/finition/devise.
Worker réel vérifié dans le navigateur PC sur Raichu FR base1-14, Charizard EN
base1-4 et リザードンex JP SV2a-006 (nom de base reconnu). Ces trois références
ne constituent pas un benchmark de scans physiques. Retour iPhone du 2 octobre :
FR/EN utilisables mais cadrage exigeant, aucun succès automatique JP rapporté.
Sur l’image TCGplayer JP du Pikachu 001/SV-P (587758), ancien bandeau large
reproduit un nom non résolu ; nouvelle lecture ciblée reconnaît ピカチュウ sur PC.
Validation de la nouvelle capture et du JP sur iPhone encore nécessaire.
Diagnostic reproductible : `node server.mjs --ocr-check`, ouvrir le lien à clé
puis `/ocr-check`. Route locale seulement, inactive par défaut et en mode tunnel.

### 3 octobre 2026 — Suffixes du titre

Séparation du Pokémon et du suffixe `ex`/`GX`/`V`/`VMAX`/`VSTAR`/`V-UNION`/
`BREAK`/`LV.X`. Titres collés, espacés ou avec tiret acceptés, y compris kana +
suffixe latin. Les petits suffixes sur la même ligne sont conservés ; mentions
« Evolves from » et « Évolution de » écartées. Deux lectures en direct doivent
concorder sur l’espèce **et** le suffixe. Sur capture JP, vérification du bandeau
large pour ne pas prendre un VMAX coupé pour V.

Suffixe lu : recherche native avec les trois formes nom/espace/tiret/collé via
les [alternatives TCGdex](https://tcgdex.dev/rest/filtering-sorting-pagination),
puis filtre des noms avant indexation. Aucun repli silencieux de VMAX vers V.
Suffixe non lu : recherche du Pokémon plus large, pas « carte normale » déduite.
`EX` ancien et `ex` moderne restent regroupés à ce stade ; numéro, extension et
impression toujours à vérifier. Même suffixe ne signifie pas même carte.

Les logos peuvent abaisser la confiance OCR du mot entier. Sur le titre ciblé
FR/EN uniquement, deux traitements (original et traits sombres) donnant exactement
le même nom du dictionnaire + suffixe connu autorisent une **hypothèse de recherche**
malgré une confiance faible. Pas de correction approximative, ni deux observations
indépendantes, ni probabilité garantie : comparaison visuelle et confirmation
humaine restent obligatoires. Une lecture isolée ou contradictoire est refusée.
Ce secours concerne « Figer et analyser », pas le déclenchement OCR en direct.

Contrôles réels sur images publiques dans le navigateur PC le 3 octobre :
Dracaufeu-ex FR `sv03.5-006` reconnu avec suffixe `ex`, sa fiche présente dans
la première page des résultats filtrés. Charizard VMAX EN `swsh3-20` non résolu :
le faux V issu de « Evolves from Charizard V » est désormais écarté. JP
`SV2a-006` : リザードン reconnu mais logo ex non lu, donc recherche large ;
Pikachu `SV-P-001` et Charizard EN `base1-4` restent reconnus. Ces essais ne
valident pas la couverture des logos ni un taux de fiabilité sur téléphone.

Premier retour utilisateur sur iPhone : bon Raichu parmi les trois candidats,
résultats rapides avec de petits lots et 2–3 secondes rapportées au-delà de
50 références. Principal manque : absence de références. Ce sont des essais
déclarés, pas un benchmark de précision/vitesse. Les packs de références vérifiées
et un index compact restent prévus pour plus tard, pas téléchargés maintenant.

- Aperçu caméra arrière à la demande, sans microphone ; images du flux analysées
  en mémoire sur le téléphone, sans sauvegarde de photo ni envoi au serveur.
- Recherche automatique par nom lu ; lot manuel de secours FR/EN/JP, nom français accepté.
  Maximum trois pages de 24 fiches ; seule une image chargée et décodée entre dans
  l'index. Le nombre de références et les limites sont affichés.
- TCGdex → secours Malie, exceptions Pokémon FR et TCGplayer JP : mêmes index
  nom/numéro/langue que l'application. Les images sont des références réelles,
  pas les cartes de démonstration du scanner Expo.
- Comparaison visuelle classique spécialisée : grille de luminance normalisée
  et couleurs, classement jusqu'à trois candidats, contrôle grossier de qualité,
  marge entre voisins ; quatre observations stables seulement en manuel/direct,
  évaluation unique sur image figée. Code MIT, sans API de
  détection payante. Les modèles OCR sont distincts des références visuelles.
- Mesures réelles du temps de chargement, nombre d'images analysées et durée
  d'une analyse. Aucun pourcentage de confiance fictif.
- Ambiguïtés visibles, résultats **à confirmer manuellement**. OCR du nom intégré ; pas de
  détection de contours, redressement de perspective ou classification de
  finition à cette étape. Une carte hors du lot peut ressembler à une référence.
  Les seuils ne sont pas calibrés sur des scans réels. Ce moteur de démarrage
  n'est pas le moteur ultime entraîné de la roadmap.
- Changement de lot, arrêt manuel, perte de caméra, arrière-plan et fermeture
  arrêtent les tracks. Une autorisation caméra reçue après annulation est rejetée
  et ses tracks fermés. La caméra ne redémarre jamais automatiquement au retour.
- Chaque candidat peut ouvrir sa fiche ; ajout uniquement après confirmation.
  Quitter le scanner ou ouvrir une fiche arrête la caméra, sans effacer le lot.
- Aucune synchronisation ni écriture dans la collection Expo Go. Prix indicatifs dans les fiches.

## Lancement local sur PC

Dans PowerShell :

```powershell
cd C:\Users\noamz\Documents\ChatGPT\TRACKTCG\scanner-web
npm start
```

Ouvrir le **lien complet** imprimé dans le terminal. La clé temporaire est
échangée contre un cookie HttpOnly et retirée de l'adresse. Le serveur écoute
uniquement `127.0.0.1:8787` par défaut. Redémarrer change la clé et invalide
l'ancien accès. Ne pas partager la clé ; elle donne accès au prototype.

Le PC doit avoir Internet pour le catalogue et les références. Aucun fichier
image n'est écrit : un cache serveur limité à 24 Mio reste en RAM. Les réponses
applicatives sont `no-store`, assets OCR figés en cache HTTP privé 24 h.
Le navigateur garde les descripteurs en RAM pendant la
session ; rechargement = préparation du lot à refaire.

`http://localhost` peut utiliser une caméra sur **le PC**. Ce n'est pas un lien
utilisable pour la caméra iPhone : `localhost` sur l'iPhone désigne l'iPhone, et
`http://192.168…` n'est pas un contexte sécurisé pour Safari.

## Test iPhone : choisir une méthode HTTPS

**Aucun tunnel ou certificat de confiance n'est créé automatiquement.**
Ne jamais désactiver la validation TLS ou contourner un avertissement navigateur.

### Option A — lien temporaire Cloudflare (accord explicite requis)

L'utilisateur a autorisé l'installation locale et le premier test le 2 octobre
2026. Binaire officiel Windows AMD64 **2026.9.3** téléchargé dans `.tools/`,
SHA-256 vérifié avant exécution ; pas de service, PATH système ou pare-feu modifié.
Voir [provenance du binaire](./cloudflared-provenance.json). Le binaire est ignoré
par Git et n'est pas redistribué dans le dépôt.

Sur ce PC, le lancement simplifié est désormais :

```powershell
cd C:\Users\noamz\Documents\ChatGPT\TRACKTCG\scanner-web
npm run share
```

Cette commande vérifie à nouveau l'empreinte du binaire et démarre le serveur
local **et** le tunnel. Elle imprime `LIEN IPHONE` avec la clé déjà incluse, après
enregistrement de la connexion. Ouvrir ce lien complet dans Safari. **Ctrl+C
arrête les deux**. Ne pas lancer en même temps `npm start` sur le même port.
La commande `npm start` seule reste entièrement locale et n'ouvre jamais de tunnel.

Le code reste sur le PC, mais le site et les requêtes de référence passent par
Cloudflare. Le flux vidéo reste sur le téléphone ; en `share:visual`, le JPEG
capturé à la demande transite aussi par Cloudflare vers le PC. Ce n'est pas un
déploiement Firebase/Cloudflare de production. Le domaine temporaire est public ;
la clé d'accès protège le prototype. Toute personne avec le lien complet peut
l'utiliser jusqu'à l'arrêt/redémarrage du serveur. Ne pas publier ce lien.

Après autorisation, installer l'outil officiel `cloudflared`, puis lancer dans
deux terminaux :

```powershell
# Terminal 1 : serveur limité à localhost, mais autorisant le domaine du tunnel
$env:SCAN_ALLOW_TUNNEL = 'true'
npm start
```

```powershell
# Terminal 2 : chemin de l'exécutable officiel installé, ou cloudflared dans PATH
cloudflared tunnel --url http://127.0.0.1:8787
```

Ajouter `/?access=LA_CLE_DU_TERMINAL_1` à l'adresse HTTPS `trycloudflare.com`
affichée dans le terminal 2, puis ouvrir ce lien dans **Safari sur l'iPhone**.
Arrêter le tunnel avec Ctrl+C termine l'accès distant ; arrêter le serveur
invalide la clé. Le PC doit rester allumé. Le nom de domaine change au prochain
tunnel et il n'y a pas de garantie de disponibilité. **Exporter la collection
avant de fermer le lien ; importer volontairement le JSON sur la nouvelle adresse.**

Sources : [Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
et [téléchargements officiels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/).
Ne pas lancer de service permanent, login Cloudflare, nouveau compte ou projet
EAS pour ce test.

### Option B — HTTPS uniquement sur le réseau local

Configurer volontairement un certificat local signé par une racine de
développement de confiance (ex. [mkcert](https://github.com/FiloSottile/mkcert)).
L'iPhone doit être sur le même réseau, installer **le certificat public racine**
et activer sa confiance complète dans les réglages iOS. Ces changements de
confiance sont manuels, sensibles et à retirer après les tests. **Ne jamais
transférer la clé privée racine ou la clé serveur sur l'iPhone.**

Le certificat serveur doit inclure l'adresse IPv4 locale réelle du PC dans son
SAN. Ensuite, dans PowerShell :

```powershell
$env:SCAN_TLS_CERT = 'C:\chemin\certificat-local.pem'
$env:SCAN_TLS_KEY = 'C:\chemin\cle-locale.pem'
npm run start:lan
```

Ouvrir `https://ADRESSE_IP_DU_PC:8443/?access=LA_CLE` dans Safari. Le serveur
n'accepte que les hôtes locaux et les IP privées. Aucun port Internet ou routeur
à ouvrir ; ne pas désactiver le pare-feu. Autoriser seulement la connexion LAN
nécessaire si Windows le demande, après accord utilisateur.

## Parcours de test sur téléphone

Pour le nouveau pilote : `npm run share:visual`, choisir la langue **de la carte**,
mode Reconnaissance visuelle · PC, activer la caméra, cadrer la carte entière,
puis « Analyser la carte ». Vérifier les propositions ; caméra arrêtée aux résultats.
Une carte absente de l’index pilote ne sera pas ajoutée automatiquement à l’index.

Parcours des anciens modes locaux :

1. Choisir la langue **de la carte** et Ancien OCR. Aucun nom à taper.
2. En secours manuel uniquement : saisir un nom français complet, charger le
   lot et consulter la liste pour vérifier que la carte physique y figure.
3. Activer la caméra et autoriser uniquement celle-ci dans Safari.
4. Carte entière, droite, dans le cadre, sans sleeve réfléchissante si possible.
   Aucun redressement automatique : le cadrage doit être précis.
5. Appuyer sur « Figer et analyser » dès que la carte est cadrée, ou laisser les
   deux lectures concordantes figer le cadre automatiquement. Vérifier que
   la caméra s’éteint avant le chargement des références et qu’on peut bouger
   le téléphone. Sans nom reconnu, utiliser « Recadrer » ou le mode manuel.
   Le temps réseau/OCR dépend du téléphone : aucune promesse de latence.
6. Vérifier les candidats : numéro, langue, extension et finition. Tester aussi
   une carte absente du lot et plusieurs réimpressions proches pour détecter les
   faux positifs. Aucun ajout automatique à la collection.
7. Arrêter, changer d'onglet et verrouiller le téléphone : vérifier que l'indicateur
   caméra iOS s'éteint et qu'il faut un clic pour reprendre.

### Tester le nouveau parcours collection

1. Catalogue : chercher « Dracaufeu » en JP, ouvrir une fiche ; langue JP et numéro natif doivent rester visibles.
2. Choisir finition/état/quantité, coût facultatif ; vérifier la carte puis cocher la confirmation et ajouter.
3. Collection : vérifier quantité et coût, sans valeur de marché inventée. Recharger puis retrouver la carte en français.
4. Exporter, vérifier le fichier JSON dans Fichiers/Téléchargements et le garder hors du stockage du site.
5. Réimporter : aperçu avant confirmation, lots déjà présents ignorés et aucune quantité remplacée.
6. Lors d'un changement de domaine, importer la sauvegarde sur la nouvelle adresse. Ne pas effacer l'ancien stockage avant de vérifier la copie.

Le test physique sur iPhone est indispensable : les tests de pixels synthétiques
et le rendu au format iPhone ne valident ni les permissions Safari/iOS, ni la
mise au point, ni la précision sur des cartes physiques.

## Vérifications

```powershell
npm test
npm run check
```

`npm ci` installe la dépendance de test uniquement, fake-indexeddb 6.2.5
([dépôt officiel](https://github.com/dumbmatter/fakeIndexedDB), Apache-2.0).
Le serveur utilise les assets Tesseract pour les anciens modes ; le pilote PC
ajoute OpenCV/NumPy dans un environnement Python isolé (voir `visual/README.md`).

Les tests utilisent le vrai module de comparaison, le vrai serveur et le vrai
contrôleur caméra avec DOM/caméra simulés. Comparaison aux helpers mobiles pour
les traductions et les liens de secours, refus SSRF/redirects/POST, budget de
référence, accès par cookie, perte de qualité, ambiguïtés et cycle de caméra.
Les tests de parité utilisent TypeScript déjà installé dans `mobile/node_modules`.
Le fonctionnement du serveur n'en dépend pas. Tests supplémentaires : validation
des sauvegardes, coûts exacts, import idempotent, transactions IndexedDB simulées,
concurrence entre connexions, conservation des données après échec, fiches exactes
et chargements concurrents de vignettes plafonnés à six requêtes externes.

Vérification du premier incrément catalogue/collection : **39 tests web réussis**, interface inspectée à
390 px, ajout de deux cartes JP avec coût, persistance après rechargement,
recherche française locale et import confirmé sans remplacer le lot existant.
Demande d'export visible, mais fichier téléchargé non confirmé par le navigateur
intégré de test : valider l'enregistrement dans Safari sur iPhone. Aucun nouveau
test physique iPhone de cette interface collection effectué par l'agent.

Refonte UX/UI : **48 tests web réussis**, contrôles de syntaxe réussis.
Huit scénarios supplémentaires du contrôleur avec DOM/IndexedDB simulés :
boutons de langue, arrêt caméra signalé par navigation/aide, position de scroll,
quantités bornées, confirmation requise et prévisualisation d'import sans écriture.
Rendus navigateur inspectés à 390 × 844 et 320 × 700, grille et sauvegarde locale
existantes conservées ; cadrage et bouton scanner visibles à 390 px après
chargement réel de références. Ce n'est pas une validation physique Safari/iPhone.
Les fichiers statiques sont mis à jour sans changer le domaine du tunnel :
recharger la page pour voir le nouveau design, ne pas effacer les données du site.

Vérification de développement du 2 octobre 2026 : 22 tests web et 42 tests
mobiles réussis, contrôles de syntaxe, TypeScript et lint réussis. Rendu inspecté
à 390 px de large et chargement réel sur PC : lot Dracaufeu FR de 69 références
sur 72 fiches en 4,1 s ; lot JP de 40 références sur 50 fiches en 3,3 s. Ces durées
dépendent du réseau/cache et ne sont **pas** des mesures iPhone ni une mesure de
précision. Le lien HTTPS protégé a été ouvert avec succès après autorisation.

Le logiciel est sous [MIT](./LICENSE). Les illustrations gardent leurs propres
droits ; ne pas redistribuer un corpus. Le dictionnaire PokéAPI préexistant garde
sa [licence BSD-3-Clause](../docs/third-party/POKEAPI_LICENSE.txt). Les conditions
d'accès aux sources doivent être revues avant une utilisation de production.

Suite produit : validation téléphone de l'interface réunie, puis synchronisation
Firebase et prix traçables ; installation PWA progressive
et hébergement Cloudflare après validation. Suite reconnaissance : protocole de
scans indépendants → détection/redressement spécialisé → OCR numéro/langue →
index visuel adapté et benchmark. Réutilisation native uniquement si décidée
ultérieurement. Ne pas confondre ce prototype limité avec la reconnaissance
universelle de la roadmap.
