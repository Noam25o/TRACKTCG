# Reconnaissance — état réel et ordre d’intégration

## 9 octobre 2026 — Portage navigateur disponible en labo

Un essai ORB + pHash + RANSAC fonctionne dans un Web Worker OpenCV.js/WASM,
sans photo envoyée ni calcul sur serveur. [Protocole](../scanner-web/phone/README.md).
Pikachu JP retrouvé dans le navigateur PC en 746 ms. Index par langue, aucune
saisie de nom/numéro ; scan sur clic, langues encore choisies explicitement.
Pas de PaddleOCR, de prix ou de collection dans cet essai autonome. Le scanner
historique reste inchangé. Safari/iPhone et sa caméra restent à valider ;
empreinte mémoire et premier téléchargement importants, documentés dans le labo.

## Contrainte d'architecture prioritaire — 7 octobre 2026

**Téléphone + Cloudflare doivent suffire en production.** Firebase est facultatif
pour comptes, profils et données. Aucun VPS, serveur de reconnaissance dédié,
PC allumé en permanence ou service d'IA externe supplémentaire.

Cible : calcul de reconnaissance dans le navigateur du téléphone, distribution
des modèles/index par Cloudflare. Un éventuel traitement géré chez Cloudflare
reste soumis à validation de faisabilité, coût et latence ; ne pas supposer que
le moteur Python actuel peut y être exécuté tel quel. Les noms de modèles
ci-dessous sont des candidats, pas des choix acquis pour la production.

Prochain jalon : vérifier les exports/runtimes navigateur et tester réellement
Safari/iPhone avant d'optimiser davantage le banc Python. Mesurer précision,
latence complète, mémoire, téléchargement de l'index et batterie. Les moteurs
exigeant un serveur externe sont exclus. Les essais sur PC ne prouvent aucune
performance sur téléphone. Le pilote PC actuel reste un outil temporaire de
développement et ne satisfait pas encore cette architecture finale.

## Cible qualité — moteurs spécialisés à comparer, 7 octobre 2026

Demande utilisateur : viser la meilleure reconnaissance possible en restant
open source, sans saisie de nom/numéro. Ce qui suit est une cible, pas une
intégration réalisée ni un classement de performances établi sur TRACKTCG.
Contrainte confirmée ensuite : le PC sert au développement, pas de dépendance
à une carte graphique personnelle ni à un PC allumé en permanence en production.
Premier banc sur Intel i5-14400F, **CPU uniquement**. Il reste une comparaison
de laboratoire, pas une proposition de serveur CPU hébergé. La contrainte
téléphone + Cloudflare ci-dessus prévaut sur cette première cible technique.

1. Capture : sélectionner une image nette, conserver ses pixels originaux en
   mémoire pour les petits textes et ne pas réduire le bandeau avant localisation.
2. Recherche visuelle : conserver ORB comme référence rapide. Comparer un modèle
   de similarité entraîné sur cartes (objectif ArcFace, pas un service de visages)
   et un extracteur DINOv2 de base si utile. L’identité est trouvée dans un index
   de références ; les modèles généralistes ne remplacent pas le catalogue exact.
3. Vérification géométrique : comparer ALIKED + LightGlue à ORB/RANSAC sur les
   seuls meilleurs candidats si cela réduit réellement les confusions. Ne pas
   ajouter un étage neuronal sans gain mesuré en précision/latence.
4. Lecture spécialisée : priorité au test de PP-OCRv5, détection des zones de
   texte puis reconnaissance de lignes, sur le PC. Numéro/code latin séparé des
   noms japonais ; modèles latin/japonais appropriés à comparer. Tesseract reste
   la baseline et n’est pas retiré avant validation. Ne jamais injecter le numéro
   attendu comme résultat OCR et ne pas inventer des détails via super-résolution.
5. Décision : fusion image/géométrie/texte, carte inconnue et conflit explicites,
   recapture ou confirmation visuelle sans saisie. Langue et finition exactes
   restent distinctes ; une finition non visible ne peut pas être garantie.

Évaluation obligatoire avant activation : photos réelles FR/EN/JP, réimpressions
très proches et inconnues ; séparation des exemples de réglage et du test final.
Mesurer identité exacte, rappel des candidats, fausses acceptations, refus et
temps total médian/p95 sur iPhone (pas seulement temps GPU). Extension de l’index
au-delà de 2 000 nécessaire pour la couverture ; bucket pas nécessaire à l’essai.
Pas de promesse de 100 %, de seuil de confiance universel ou de latence garantie.

Sources primaires consultées :

- [TCG-AR / ULiege](https://github.com/ULiege-VIULab/tcg-ar) : pipeline spécialisé
  détection/orientation/ArcFace, 85,1 % top-1 et 96,2 % top-5 annoncés sur leur
  évaluation réelle ; les résultats supérieurs avec deck restreint ne sont pas
  comparables à notre recherche sans présélection. Code GPL-3.0, poids et
  dépendances à examiner séparément avant réutilisation ; pas installé.
- [PaddleOCR / PP-OCRv5](https://github.com/PaddlePaddle/PaddleOCR) et
  [modèles de reconnaissance](https://paddlepaddle.github.io/PaddleOCR/main/en/version3.x/module_usage/text_recognition.html) :
  candidats OCR spécialisés, pas de résultat établi sur la photo utilisateur.
- [ALIKED + LightGlue](https://github.com/cvg/LightGlue) : LightGlue code/poids
  Apache-2.0, ALIKED BSD-3-Clause selon les auteurs ; ne pas substituer SuperPoint
  sans examen de sa licence restrictive.
- [DINOv2 de base](https://github.com/facebookresearch/dinov2) : code/poids
  Apache-2.0 ; ne pas assimiler les variantes médicales ni DINOv3 à cette licence.

PaddleOCR est désormais installé dans un environnement CPU isolé pour le banc
comparatif ; aucun changement du scanner public. Les autres modèles restent
à comparer, non installés. Voir le protocole et les mesures dans
`scanner-web/visual/OCR_CPU.md` ; architecture de recherche neuronale ensuite.

## Parcours actuel sans saisie — 7 octobre 2026

Décision utilisateur explicite : pas de nom, numéro ou extension à saisir dans
le scan. Le formulaire et le clic OCR sont retirés ; le lien public garde la
reconnaissance visuelle rapide avec confirmation, sans OCR du numéro activé.
En diagnostic local uniquement, une vérification automatique du numéro a été
préparée si le score visuel est faible/proche.
Le redressement utilise l’homographie du meilleur candidat pour retrouver le
bas de la capture originale, pas pour recopier la référence. Bandeau envoyé
au téléphone en retour de la même requête ; Tesseract local s’exécute seul,
maximum huit secondes, annulable à la sortie/arrière-plan. Pas de photo retenue
aux résultats. Les cas forts évitent l’initialisation OCR.

Lecture large à deux échelles et troisième passe en traits sombres si nécessaire,
sans zoom sur une boîte de mot ni caractères forcés ; deux fractions concordantes
avec confiance ≥55 requises. Bandeau couleur PNG sans perte, ≤700 ko. Aucun
abaissement des seuils. Doute/conflit : recadrer ou confirmer
visuellement, jamais taper. Un numéro compatible n’est pas une preuve complète
d’édition, langue ou finition ; le choix FR/EN/JP reste explicite. OCR des codes
promos seulement, alias et symboles d’extension généraux encore à intégrer.
L’index reste partiel à 2 000 ; pas de nouveau bucket nécessaire à cet incrément.

Vérification navigateur élargie : onze bonnes références visuelles, trois numéros
confirmés (Raichu FR 14/102, Charizard VMAX EN 020/189, Florizarre ex JP 003/165)
et huit refus sur des captures publiques synthétiques. Pikachu JP 001/SV-P
reste refusé. Lot également utilisé pour les réglages, pas une précision indépendante.
Ce contrôle reste expérimental et n’est pas activable via un paramètre du tunnel.
86 tests web / cinq Python
réussis ne prouvent pas sa fiabilité OCR. Suite : améliorer et valider cette
lecture sur un lot de photos réelles avant activation pour les tests iPhone.

## Historique remplacé — affinage facultatif du numéro, 7 octobre 2026

Les propositions ORB arrivent sans attendre l’OCR. Une lecture locale optionnelle
du bas de la capture utilise le Tesseract existant (modèle eng, chiffres/codes
latins même pour JP). Deux découpes doivent donner la même fraction ou promo ;
ce sont deux vues d’une seule image, pas une preuve indépendante. Aucun nom
n’est requis. La saisie manuelle permet aussi un numéro et un code d’extension.
Le numéro réordonne les propositions sans les supprimer ni les valider ; un
conflit garde les candidats initiaux et affiche un avertissement. Le total
d’une fraction ne prouve pas l’extension. OCR des symboles/abréviations générales,
désambiguïsation complète de l’impression et finition restent à faire.

Capture transitoire conservée au maximum deux minutes en RAM du téléphone
après les résultats, puis libérée ; arrêt immédiat navigation/arrière-plan/
nouveau scan. Aucun nouvel upload, aucun stockage persistant. 80 tests web et
quatre tests Python passent. Mesure et validation sur iPhone nécessaires.

## État actuel — index visuel PC élargi, 7 octobre 2026

Index de 2 000 empreintes : 667 FR, 667 EN, 666 JP, environ 65,40 Mo, sans
corpus d’images conservé. Construction reprenable et sauvegarde du pilote 411.
Échantillon de 18 cartes × trois transformations synthétiques : 54/54 bonnes
références en premier, également après remplacement de chaque référence testée
par son WebP Q50 (pas de conversion de tout l’index). Médiane moteur 157 ms,
p95 250 ms, hors réseau/capture. Neuf cartes absentes × trois transformations :
un faux positif initial, puis zéro après seuil géométrique porté de 12 à 24
points. Ajustement et retest sur le même lot, pas une validation indépendante.
Compression de l’échantillon : 7,52 Mo → 1,04 Mo, sans images sauvegardées.
WebP retenu comme piste à valider, pas de migration R2 ni promesse de précision.

Meilleur candidat mis en avant, alternatives accessibles et ouvertes lorsque
les scores sont proches ; confirmation d’impression toujours obligatoire.
75 tests web et trois tests Python réussis. Prochaine validation : captures
iPhone sur cartes connues/inconnues, impressions proches et cartes physiques,
puis OCR numéro/extension. Voir [protocole et limites](../scanner-web/visual/README.md).

## Décision du 3 octobre 2026 — pilote visuel PC autorisé

Après un retour iPhone négatif sur la capture/OCR, ne plus imposer la lecture
du nom comme porte d’entrée. L’utilisateur a explicitement autorisé l’envoi
d’une capture via le tunnel Cloudflare protégé à son PC Windows, analyse en RAM
sans conservation ni API d’IA tierce. Flux vidéo non envoyé.

Nouveau parcours : carte entière, capture demandée, aperçu vivant pendant
la comparaison, propositions puis vérification humaine. Inspiration du parcours
photo décrit par [Collectr](https://getcollectr.notion.site/Scanning-for-Products-130f17a424d480f39648e43114688c76)
et [PokéItem](https://www.pokeitem.fr/scanner-cartes-pokemon), pas de leur moteur
propriétaire ni de promesse de performances équivalentes. Pas de capture
automatique ou de file de scans multiples à ce stade.

Baseline open source classique OpenCV ORB/Hamming/RANSAC, avec redressement
d’un contour quadrilatère quand détecté. Index local pilote de 411 empreintes
FR/EN/JP, pas de corpus d’images conservé. Préfiltre pHash puis cohérence
géométrique ; pas de réseau neuronal spécialisé entraîné. Recherche sans
chargement réseau de candidats au scan ; images/fiches des résultats restent
distantes. Catalogue nettement plus grand que l’index, couverture partielle
signalée. OCR numéro/extension, fusion et benchmark physique encore nécessaires.

Le mode est activé uniquement par `--visual-pc`/`SCAN_VISUAL_PC=true`.
Les anciens modes restent entièrement locaux ; les descriptions « aucun upload »
et « pas de redressement » ci-dessous sont **historiques, propres à ces modes**.
74 tests web et contrôles Python ; pas de précision validée sur iPhone.
Voir [méthode, audit et limites](../scanner-web/visual/README.md).

## Historique — web mobile prioritaire, 2 octobre 2026

Le prototype Safari devient la base du scanner de la V1 web. Le développement
natif Expo est conservé comme option, pas comme prochaine étape obligatoire.
Firebase et Cloudflare restent prévus ; aucune migration de collection ou
publication permanente n'est effectuée par cette décision.

Retour utilisateur sur iPhone : bon Raichu dans les trois candidats ; environ
2–3 secondes rapportées avec plus de 50 références. Couverture insuffisante
identifiée comme problème principal. Ce retour ne fournit ni le nombre total
de scans, ni des mesures instrumentées, ni une précision validée. Les références
vérifiées/index téléchargeables sont conservés pour plus tard sans téléchargement
massif maintenant. Voir [l'ordre de travail actualisé](../ROADMAP.md#ordre-de-travail).

Le web réunit maintenant catalogue, scanner et collection. Un candidat visuel
peut ouvrir sa fiche réelle ; la vérification explicite de l'impression précède
tout ajout volontaire. La caméra s'arrête en quittant le scanner ou en ouvrant
une fiche. Première lecture OCR du nom maintenant intégrée : Tesseract.js 7,
WASM et modèles FR/EN/JP locaux. Deux lectures concordantes figent le cadre qui
a servi à lire le nom, arrêtent la caméra et lancent la recherche sans préparer
le Pokémon, puis la comparaison de l’image figée. « Figer et analyser » permet
la capture explicite avant OCR ; la personne n’a plus à maintenir son téléphone
pendant le réseau. Capture RAM seulement, effacée à l’arrêt/résultats/navigation.
Pas de sauvegarde, upload, galerie ou capture en arrière-plan. Petits textes
d’évolution écartés par taille ; noms multiples refusés. Dictionnaire de 1 025
espèces, donc dresseurs/énergies/certains noms stylisés encore en recherche manuelle.
Redressement, OCR du numéro/extension et index global restent à intégrer.
Collection IndexedDB et sauvegarde JSON locales inchangées, sans écriture Expo
ou synchronisation Firebase. Prix indicatifs distincts de la valorisation qualifiée.

Le worker est terminé même pendant son initialisation à l’arrêt/arrière-plan/
navigation, sans envoi de frames. Versions et empreintes :
[provenance OCR](../scanner-web/ocr-provenance.json). 71 tests web ; lectures réelles
sur références publiques dans le navigateur PC, pas un test caméra ou un
benchmark de fiabilité sur téléphone. L’OCR de démarrage ne remplace pas l’audit
comparatif et le benchmark des moteurs de la version ultime.

Retour complémentaire iPhone : FR/EN utilisables avec centrage exigeant, aucun
succès JP rapporté (Pikachu 001/SV-P). Échec reproduit sur son image TCGplayer JP
avec l’ancien bandeau. Titre ciblé hors PV puis lecture correcte ピカチュウ sur PC.
Essais de secours bornés sur capture : traits sombres, bandeau élargi. Pas de
correction approximative du nom ; seuil de kana expérimental. À retester sur
cartes physiques avant toute conclusion de fiabilité. Une image fixe n’est pas
quatre frames indépendantes : qualité, distance et ambiguïté conservées, résultat
toujours à confirmer. Redressement et cadrage automatique non implémentés.

Incrément du 3 octobre : suffixes ex/GX/V/VMAX/VSTAR/V-UNION/BREAK/LV.X séparés
du nom natif, conservés dans la recherche et filtrés avant chargement des images.
V et VMAX ne confirment pas la même lecture ; suffixe non lu reste inconnu.
EX ancien/ex moderne regroupés, pas d’identité d’impression déduite. Vérification
large JP sur capture contre les suffixes coupés ; textes d’évolution exclus.
FR/EN : quatre essais maximum sur capture. Secours pour logos stylisés uniquement
si deux traitements du titre ciblé concordent exactement sur nom + suffixe ;
confiance faible reste une hypothèse de recherche, pas une preuve d’identité ni
deux scans indépendants. Aucune correction floue ou baisse du seuil du scan en
direct. Voir les essais et limites dans le [README web](../scanner-web/README.md).

## Prototype Safari — 2 octobre 2026

Utilisateur sans Mac ni compte Apple Developer payant : voie alternative web
acceptée, sans remplacer l'app Expo ni sa collection. [Prototype et instructions](../scanner-web/README.md).
Caméra navigateur et extraction en mémoire ; comparaison visuelle classique
réelle sur un lot plafonné à 72 fiches FR/EN/JP, contrôles de qualité grossiers,
marge entre voisins, quatre observations stables et confirmation humaine.
Chargement des références via les mêmes sources/correspondances que le mobile.
Aucun upload de frame, OCR, redressement automatique, poids entraîné, prix de
marché ou ajout automatique. Les seuils sont expérimentaux ; aucun score de précision
annoncé. Les tests avec caméra/pixels synthétiques ne remplacent pas les scans
physiques. Le rendu et le chargement peuvent être testés sur le PC ; Safari sur
iPhone exige HTTPS reconnu, via certificat local configuré volontairement ou
lien temporaire Cloudflare après autorisation explicite. Pas de tunnel automatique.

Cette voie permet de développer et tester le scan sans installer un binaire iOS.
La contrainte ci-dessous reste applicable au **processeur de frames natif**, pas
à tout développement de scanner. Le moteur classique limité ne remplace pas le
futur audit/benchmark des moteurs spécialisés de la roadmap.

## Préparation iPhone — 2 octobre 2026

Appareil confirmé : iPhone ; poste actuel : Windows. Client de développement
Expo et profils iOS préparés localement, sans build cloud ni création de projet
EAS distant. Le mode Expo Go reste explicitement disponible avec `npm start`.
Cette préparation n'ajoute ni processeur de frames ni moteur de reconnaissance.
Il faut choisir entre Mac/Xcode et EAS avec compte Apple Developer payant avant
de pouvoir installer et valider le prochain prototype natif.
Voir [installation iPhone et préservation de la collection Expo Go](./BUILD_IOS.md).

## Vérification du 29 septembre 2026

Le scanner actuel affiche la caméra et un parcours de démonstration. Il ne reconnaît pas de carte. Aucun résultat simulé ne doit être présenté comme une mesure de précision.

La référence [TCG-AR](https://github.com/ULiege-VIULab/tcg-ar) est un projet de recherche pour Windows avec GPU NVIDIA. Ses chiffres publiés sont notamment 85,1 % top-1 en identification ouverte et 96,4 % sur un ensemble restreint aux decks. Ce ne sont ni une précision d’impression exacte FR/EN/JP ni une mesure sur téléphone. L’objectif de 99,5 % de précision des résultats acceptés reste un objectif à démontrer, pas une capacité disponible.

Le dépôt annonce GPL-3.0 ; les dépendances, poids et droits des données doivent être inventoriés individuellement avant redistribution. Aucune implémentation ou aucun poids TCG-AR n’est embarqué actuellement. ArcFace désigne une méthode d’apprentissage : un modèle de reconnaissance de visages utilisant ArcFace ne peut pas servir à reconnaître des cartes sans entraînement adapté.

## Contraintes mobiles

L’API [Expo Camera SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/camera/) expose l’aperçu, la capture et la lecture de codes-barres, sans le processeur de frames natif requis par notre chaîne. La reconnaissance continue en mémoire devra être intégrée dans une [development build](https://docs.expo.dev/develop/development-builds/introduction/), avec un module caméra et un runtime d’inférence compatibles. Expo Go reste utilisable pour le catalogue et la collection. Ne pas remplacer le flux demandé par des prises de photos silencieuses.

## Incréments suivants

1. **Référence catalogue (implémentée)** : recherche TCGdex FR/EN/JP, détails et identité `tcgdex:<langue>:<id>`. Le catalogue distant n’est pas encore un index visuel local. Ne pas confondre les identifiants TCGdex et Pokémon TCG API ; une table de correspondance explicite sera nécessaire avec un index issu de TCG-AR.
2. **Validation du prototype web sur téléphones** : conserver la base Safari, formaliser les retours, vérifier géométrie du cadrage, arrêt de caméra, frames distinctes et budget CPU/batterie sur Safari/iPhone puis Chrome/Android. Les premiers essais utilisateur ne remplacent pas un protocole reproductible.
3. **Audit et benchmark des modèles** : collecter les licences et les empreintes des poids, préparer des cartes de test indépendantes et comparer la version source avec son export pour navigateur mobile. Mesurer séparément détection, orientation, identité, impression, langue, latence p50/p95, mémoire et refus ; aucune intégration native préalable exigée.
4. **Chaîne spécialisée** : qualité → détection/redressement → représentation visuelle → index local → OCR du numéro/langue → fusion sur plusieurs frames. Aucun envoi d’image au serveur par défaut.
5. **Résolution et validation** : jusqu’à trois candidats, confirmation des ambiguïtés, refus des images insuffisantes et seuils calibrés sur des scans réels. Aucun score interne affiché comme une probabilité garantie.
6. **Distribution de l’index** : catalogue de référence figé/versionné, sommes de contrôle, mises à jour progressives et retour arrière. Quantifier les pertes de précision liées à la compression/quantification avant adoption.
7. **Option native ultérieure** : seulement si décidée par l'utilisateur après validation du web ; vérifier alors SDK, accès aux frames et développement signé sur appareil, sans prendre les tests web comme preuve de compatibilité native.

## Catalogue et prix

L’API publique [TCGdex](https://tcgdex.dev/rest) fournit des métadonnées et des liens d’images. Le code du catalogue n’est pas une licence sur les illustrations Pokémon. L’interface indique la source et les ayants droit ; aucun corpus d’images n’est redistribué dans le dépôt.

Les valeurs de marché ne sont pas automatiquement propres à une langue, une
finition ou un état. Les fiches web affichent désormais des quotes Cardmarket EUR
et TCGplayer USD via TCGdex, source/date/métrique/variante et portée indiquées.
Correspondances parfois erronées selon la FAQ TCGdex : repères, pas des devis pour
une carte française en état NM. Cardmarket brillante ne sépare pas holo/reverse.
Prix absents jamais remplacés par zéro, dates inconnues/anciennes explicités.
Pas de source JP qualifiée intégrée ni de conversion de devise. `marketPrice`
qualifié et valorisation totale restent à `null` ; quotes exclues du stockage et
des sauvegardes afin de ne pas importer une valeur falsifiée/périmée.
