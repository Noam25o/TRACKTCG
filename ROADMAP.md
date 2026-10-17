# TRACKTCG — Feuille de route produit

Ce document est la référence du projet. L'objectif final est de construire une application web de reconnaissance, de valorisation et de gestion de cartes TCG pensée pour le téléphone, inspirée des meilleures fonctions de Collectr sans en copier l'identité, le design ou le code. Une application native Android/iOS pourra être décidée après validation du produit web ; elle n'est plus un prérequis de la V1.

## Avancement

### 15 octobre 2026 — CACHE 1 et retour multilingue positif

Utilisateur iPhone 14 Pro : quatre cartes FR/EN/JP reconnues, Badge FR XY209
volontairement absent ne donne rien. Base AUTO 3 conservée, sans modifier moteur,
seuils ou index de 2 000 références. Pas de fiabilité globale extrapolée.

Premier téléchargement moteur + une langue réduit de ~34,5 Mo bruts à ~17,6 Mo
Brotli sans perte. Fichiers versionnés par SHA-256, cache HTTP du moteur et
CacheStorage des références avec contrôle taille/empreinte à chaque lecture,
remplacement de la version précédente par langue et repli réseau si cache
indisponible/corrompu. Jamais de photos mises en cache ou téléversées.
115 tests Node passent. Vérification HTTPS Chromium/Windows : 1692 ms réseau
puis 1229 ms après rechargement avec index lu dans le cache local. À mesurer sur
Safari/iPhone ; le cache dépend du nom de domaine et n'offre pas de page hors ligne.
Stockage local décompressé ~21,7 Mo/langue, mémoire WASM toujours 128 Mio.

Prochaine étape : retour iPhone sur premier/second chargement à adresse et langue
identiques, puis tests physiques et optimisation supplémentaire avant extension
massive. Cloudflare pour hébergement/bucket futur ; Firebase facultatif pour
profils/données. Aucun VPS, serveur d'inférence ou PC permanent requis en production.
Le tunnel actuel sert seulement les fichiers du prototype, pas la reconnaissance.

### 10 octobre 2026 — AUTO 3 confirmé sur le Pikachu de test

Banc multilingue ajouté et exécuté sans changer le moteur : 36/36 essais
conformes (six cartes connues × trois mises en scène = 18 positifs ; trois
références absentes × trois mises en scène + neuf fonds unis = 18 négatifs).
Images synthétiques issues de références numériques, pas une précision caméra
réelle ; 108 tests Node toujours verts. Rapport reproductible
`scanner-web/phone/auto3-report.json`. Prochain verrou : autres cartes FR/EN/JP
sur iPhone et référence absente, avant toute extension du catalogue.

Utilisateur iPhone 14 Pro : fonctionnement parfait signalé après correction.
Capture Safari : résultat final Pikachu JP 001/SV-P ; chargement 2387 ms,
tentatives 1010 ms moteur avec repli complet, puis 477 ms sur zone cadrée.
Ne pas assimiler ces temps au délai depuis l'ouverture caméra ni généraliser
la validation à toutes les cartes. Base AUTO 3 conservée sans modification des
seuils ; étape suivante : banc multilingue avec références absentes, puis tests
réels FR/EN/JP. Aucun agrandissement de l'index ni bucket créé à ce stade.

### 10 octobre 2026 — AUTO 3 : corriger la régression avant d'élargir

Retour terrain AUTO 2 : automatique inutilisable, manuel environ 1/10, cadre
trop large. Proportions corrigées à 63:88 et pixels analysés alignés au guide ;
repli local sur l'image complète si aucun résultat. Déclenchement par essais
espacés de reconnaissance, sans seuil préalable de stabilité, borné à dix
tentatives / 25 s avant pause (aucun nouvel essai au-delà). Pas d'inférence
concurrente ni de photo envoyée. 108 tests Node réussis et neuf essais sur une
photo réinsérée dans des caméras synthétiques reconnus. Ces tests ne reproduisent
pas encore le problème manuel réel : retest iPhone obligatoire. Ne pas élargir
le catalogue ni présenter le scanner comme fiable avant validation terrain.

### 10 octobre 2026 — Premier retour iPhone et cadrage automatique

Suivi : capture automatique non validée sur iPhone (reste sur « Stabilise »
puis pause), malgré analyse manuelle ~500 ms et chargement ~2700 ms. Version
AUTO 2 : compensation des petites variations d'exposition et de translation,
progression et diagnostic local, relance après pause. Échec ancien reproduit
sur photo locale perturbée, corrigé dans ce banc ; 106 tests Node réussis.
Retest caméra iPhone nécessaire, pas de garantie de correction terrain.

Retour utilisateur : iPhone 14 Pro, Safari iOS 18.6.2, Pikachu JP 001/SV-P
reconnu avec 666 références. Chargement 2502 ms ; cinq analyses de 487 à
550 ms (moyenne 510,6 ms). Aucune chauffe ni lenteur ressentie. Mesure limitée
à cette carte et au mode manuel, pas une garantie de performance générale.
Labo : cadre portrait et déclenchement unique après stabilité d'une zone
texturée, puis arrêt caméra. Bouton manuel conservé ; zéro saisie de nom ou
numéro. Ce déclenchement reste à tester sur iPhone, ce n'est pas un détecteur
de carte. Aucun upload, VPS ou moteur distant ajouté.

### 9 octobre 2026 — Premier labo de reconnaissance dans le navigateur

Portage ORB/pHash/RANSAC en WebAssembly, isolé du scanner historique. Export
statique sans API d'analyse, sans upload et sans dépendance Python sur téléphone.
Bonne carte Pikachu JP retrouvée dans Chromium/Windows en 746 ms ; six références
FR/EN/JP retrouvées, trois absentes refusées dans le banc Node/WASM. Ce ne sont
ni des mesures iPhone ni un taux de précision général. 93 tests web / sept Python
réussis. Index 2 000 inchangé, téléchargé par langue (~21,7 Mo) ; runtime ~12,8 Mo,
réservation WASM 128 Mio hors autres allocations. Validation Safari/mémoire
nécessaire avant activation dans l'application principale.
[Labo, protocole et limites](scanner-web/phone/README.md).
Cloudflare pour le futur bucket, Firebase facultatif ; aucun VPS, aucun moteur
de reconnaissance hébergé sur PC. Le lien temporaire sert seulement les fichiers.

### 7 octobre 2026 — Contrainte ferme : téléphone + Cloudflare uniquement

- En production, un téléphone et Cloudflare doivent suffire ; Firebase reste
  facultatif pour les comptes, profils et données de collection.
- Aucun VPS, serveur Python/Node dédié ou PC personnel allumé pour reconnaître
  les cartes. Aucun service d'inférence externe supplémentaire prévu.
- Cible de travail : reconnaissance dans le navigateur du téléphone, modèles
  et index distribués par Cloudflare. Un éventuel complément de calcul chez
  Cloudflare exige une validation explicite de compatibilité, coût et latence ;
  ce n'est pas une capacité déjà acquise du prototype.
- Le pilote ORB sur PC et le banc PaddleOCR CPU sont des références de test
  locales, pas des composants de production à déplacer vers un serveur loué.
- La prochaine priorité remplace l'optimisation Python CPU proposée plus bas :
  vérifier le portage navigateur et mesurer sur Safari/iPhone (temps, mémoire,
  chargement de l'index, batterie, précision). Écarter les modèles qui exigent
  une infrastructure interdite, même s'ils gagnent sur le PC.
- Zéro saisie manuelle et moteurs open source restent requis. Faisabilité et
  performances de la chaîne complète sur téléphone encore à démontrer.

### 7 octobre 2026 — Comparaison OCR effectuée sans GPU

Banc CPU isolé PaddleOCR/Tesseract créé et exécuté : photo Pikachu réelle
d'écran, deux résolutions, six références numériques FR/EN/JP. Sur la photo
native, le modèle PP-OCRv5 léger lit 001/SV-P en 3,53 s à chaud, le modèle
serveur en 15,26 s ; Tesseract refuse. Modèle léger en échec sur la version
réduite, limites sur les minuscules textes et lettres de rareté accolées.
Mode CPU standard utilisé après échec oneDNN Windows : performances optimisées
non encore mesurées. Pas d'activation publique, index/tunnel inchangés.
89 tests web et sept tests Python réussis. [Mesures et limites](scanner-web/visual/OCR_CPU.md).

Suite initialement envisagée, remplacée par la contrainte téléphone ci-dessus :
runtime CPU optimisé et localisation plus ciblée, puis captures réelles
indépendantes avec inconnues avant intégration. Conserver la recherche visuelle
rapide et utiliser l'OCR seulement si nécessaire, toujours sans saisie manuelle.
La production sera hébergée plus tard, sans PC personnel allumé en permanence.

### 7 octobre 2026 — Priorité à la meilleure reconnaissance mesurée

L’utilisateur réaffirme l’exigence de qualité. Cible documentée dans
`docs/RECOGNITION.md` : capture nette haute résolution, recherche visuelle
spécialisée cartes (ArcFace à comparer à ORB), vérification géométrique ciblée,
PP-OCRv5 pour localiser/lire le texte et fusion prudente des indices. Aucun nom
ou numéro à saisir. Contrainte précisée ensuite : CPU d’abord, PC réservé au
développement et aucun GPU personnel requis en production. PaddleOCR installé
en environnement isolé pour la comparaison OCR locale, sans remplacer
la version rapide avant gain démontré. Benchmark indépendant FR/EN/JP avec
inconnues, impressions proches, faux positifs et latence iPhone requis.
Les annonces de précision sur GitHub ne sont pas nos résultats ; aucun 100 %
promis. Licences code/poids à vérifier pour chaque composant avant intégration.

### 7 octobre 2026 — Première photo utilisateur pour le numéro japonais

Photo de Pikachu JP 001/SV-P fournie (1492 × 2048). Bonne référence visuelle
retrouvée en premier en 352 ms après réduction 900 × 1257, puis 244 ms avec
l’original. OCR du numéro refusé dans les deux essais (1,37–1,43 s de lecture
et démarrage sur PC). Référence non manquante ; le numéro catalogue affiché
n’est pas une lecture réussie. Bandeau OCR toujours ramené à 900 × 252 :
la comparaison ne permet pas d’exclure une perte de détail ni d’attribuer
l’échec au seul moiré. Diagnostic local doté d’un import JPEG volontaire ;
photo non copiée au projet, tunnel et index inchangés. Suite : localiser le
texte blanc/contour sombre en bas de la capture avant lecture spécialisée.

### 7 octobre 2026 — Lecture du numéro : progrès local, activation différée

- Suppression du zoom serré sur la boîte OCR : contexte large à 1500 puis 1000 px, troisième lecture en traits sombres uniquement si nécessaire. Deux lectures concordantes avec confiance ≥55 ; conflit refusé, aucun texte attendu injecté.
- Bandeau redressé couleur PNG sans perte, 900 × 252 et ≤700 ko, en mémoire seulement. Le JPEG de capture initial reste inchangé. Interpolation linéaire conservée ; essais gris/cubique non retenus.
- Onze références publiques dégradées : onze bonnes cartes en premier ; numéros confirmés pour Raichu FR 14/102, Charizard VMAX EN 020/189 et Florizarre ex JP 003/165. Huit refus, dont Pikachu JP 001/SV-P. OCR+démarrage 0,85–1,92 s sur ce PC, hors capture/réseau. Lot utilisé pour ajuster le lecteur, pas un benchmark indépendant.
- Cinq passes essayées sans gain sur les cas difficiles mesurés : retour à trois maximum. Arrêt anticipé après accord de deux lectures, budget global huit secondes et annulation conservés.
- 86 tests web / cinq Python / syntaxe réussis. Le contrôle reste réservé au diagnostic local ; pas d’activation publique ni de redémarrage du tunnel. Prochain besoin : capture originale iPhone, puis validation sur un lot indépendant et cas négatifs avant activation.

### 7 octobre 2026 — Correction de trajectoire : zéro saisie dans le scan

- Objectif confirmé : aucun nom, numéro ou code d’extension à saisir. Retrait du formulaire et du bouton OCR facultatif ; la recherche manuelle du catalogue reste distincte du parcours de scan.
- Recherche ORB rapide inchangée sur le lien public, sans OCR du numéro activé. En diagnostic local seulement, vérification OCR déclenchée seule si le meilleur candidat a moins de 80 points ou si le second score atteint 65 % du premier. Seuils expérimentaux à calibrer sur photos réelles, pas une confiance garantie.
- Redressement du bas de la capture originale par inversion/composition de l’homographie. Le bandeau 900 × 252 retourne au navigateur pour une lecture locale, pas de pixels de la référence utilisés comme texte capturé.
- Lecture générale puis confirmation ciblée sur le numéro repéré, deux réponses concordantes requises. Budget huit secondes ; annulation en quittant le scanner. Pas de conservation photo de deux minutes ni de saisie de secours aux résultats.
- En cas de doute : recadrage ou choix visuel. Aucun ajout automatique ; numéros identiques ne prouvent pas une impression identique. Reconnaissance générale des symboles/codes d’extension et auto-détection de langue restent à développer.
- Bucket, Firebase et extension massive du catalogue restent après validation de ce parcours. Index et références haute résolution conservés.
- Validation : 85 tests web / cinq Python / syntaxe réussis. Dans le navigateur, Raichu FR, Charizard VMAX EN et Pikachu JP sont bien premiers, mais les trois contrôles du numéro échouent prudemment. Ne pas activer cet OCR sur le lien public avant amélioration et validation sur captures réelles ; aucune promesse de lecture automatique acquise.

### 7 octobre 2026 — Affinage facultatif par numéro et code d’extension

- Résultats visuels immédiats conservés ; panneau replié avec « Lire le numéro » et saisie manuelle. L’OCR ne ralentit pas l’arrivée des propositions puisqu’il ne démarre qu’au clic.
- Tesseract local existant, modèle eng pour chiffres/codes latins FR/EN/JP, deux découpes du bas de la même capture avec lecture concordante. Préfixes et promos gérés, aucune correction approximative O/0. Pas de garantie de lecture sur flou, reflet ou perspective.
- Correspondance exacte du numéro et éventuellement du code catalogue d’extension ; dénominateur numérique non interprété comme une extension. Seuls les codes promos explicites comme SV-P sont reconnus dans la référence OCR. OCR des logos d’extension et table d’alias restent à intégrer.
- Propositions compatibles placées devant, autres propositions toujours accessibles. Aucun ajout/sélection automatique ; conflit et absence de lecture n’effacent pas le résultat visuel.
- Capture en RAM du téléphone pendant deux minutes maximum aux résultats ; libérée au nouveau scan, navigation, arrière-plan, fermeture ou expiration. Worker annulable même pendant son initialisation, aucune réponse tardive appliquée. Aucun second envoi d’image, stockage persistant ou modification de l’index 2 000.
- 80 tests web, quatre tests Python et syntaxe réussis. Navigateur sur références publiques à 900 × 1257 : numéros Raichu FR 14/102 et Charizard VMAX EN 020/189 lus ; Pikachu JP 001/SV-P non lu, saisie manuelle compatible. Raichu à 450 × 630 également refusé. Expiration et conflit manuel vérifiés ; ce n’est pas une validation iPhone. Suite : photos réelles, géométrie du bas de carte et correspondances d’extensions avant fusion automatique.

### 7 octobre 2026 — Comparaison réelle TCGdex high/low WebP

Test distinct de la compression Q50 : versions servies par TCGdex sur douze
cartes (Set de Base FR/EN, SV2a JP), trois vues synthétiques chacune. PNG high,
WebP high et WebP low retrouvent tous la bonne référence en premier sur 36/36
requêtes par format. WebP high : 81 ko/image en moyenne ; low : 20 ko, soit
environ −75 %. Médianes moteur 173/170 ms : pas de gain de vitesse démontré.
Moins de points géométriques avec le low, malgré absence d’erreur sur ce lot.
Pas de scans indépendants ni de test de faux positifs ici ; une référence à la
fois remplacée en RAM, index disque et serveur inchangés. Conserver l’index
actuel ; valider le low sur photos réelles avant de réduire les références.
Outil reproductible et rapport détaillé dans `scanner-web/visual`, quatre tests
Python réussis. Aucun corpus d’images stocké ou transfert R2 effectué.

### 7 octobre 2026 — Passage à 2 000 références et étude WebP

- Index local élargi : FR 667, EN 667, JP 666 ; 65,40 Mo d’empreintes/métadonnées, aucune image conservée. Pilote de 411 sauvegardé ; construction reprenable, répartition entre extensions et rapport des sources indisponibles.
- 18 références, trois transformations synthétiques chacune : 54/54 bons premiers résultats, avec les originaux puis les références WebP qualité 50. Requêtes issues des originaux ; seule la référence cible est remplacée, pas tout le corpus. 7,52 Mo d’images sources deviennent 1,04 Mo en mémoire (environ −86 %). Encodage OpenCV, effort Squoosh non reproduit.
- Médiane moteur 157 ms, p95 250 ms sur ce PC, hors capture/réseau/affichage. Comparaison des six anciennes cartes : médiane 140 ms avec 411 références contre 142 ms avec 2 000 ; p95 respectifs 236 et 329 ms. Petit lot, pas de promesse de latence iPhone.
- Neuf cartes absentes, trois variantes : un faux positif initial (12 points), puis 27/27 refus après seuil porté à 24 points. Même lot utilisé pour ajuster et retester : il faut un nouveau lot indépendant, notamment des photos physiques et des réimpressions proches.
- Résultat principal mis en avant ; alternatives dépliables, ouvertes en cas de scores proches. Aucun candidat éliminé par la présentation, aucune validation automatique d’impression/finition.
- 75 tests web, trois tests Python et syntaxe réussis. WebP reste une piste validée sur ce petit échantillon seulement ; aucun stockage R2, backend Firebase ou déploiement permanent ajouté.

Suite immédiate : retester la version élargie sur iPhone avec le seuil renforcé,
mesurer le temps total et les refus, puis OCR numéro/extension pour distinguer
les impressions proches. La roadmap ultime reste inchangée.

### 5 octobre 2026 — Retour utilisateur sur le pilote visuel PC

L’utilisateur rapporte une reconnaissance presque instantanée, sans cadrage
précis. Il précise scanner des images affichées sur un ordinateur : retour
qualitatif sur écran, sans temps instrumenté, nombre d’essais ou taux de réussite
fourni. Ne pas assimiler ce retour à une validation sur cartes physiques.
Retour détaillé reçu sur les six références choisies dans l’index existant :

- Alakazam FR base1-1 : environ une seconde, différents angles et nom coupé acceptés ; plusieurs candidats affichés.
- Tortank-ex FR sv03.5-009 : presque instantané, légère inclinaison et nom coupé acceptés.
- Butterfree V et VMAX EN swsh3-1/2 : comportement rapporté identique à Tortank-ex.
- Florizarre ex JP SV2a-003 : instantané, nom coupé accepté ; plusieurs autres candidats affichés.
- Poké Ball JP SV-P-010 : instantané, carte partiellement coupée acceptée.

La bonne référence est rapportée comme retrouvée pour les six cartes ; rang
exact et nombre de tentatives non précisés. Ces observations concernent les
images publiques affichées à l’écran, issues des sources indexées, et ne
constituent ni une précision de 100 % ni une validation de finition/impression.
Le moteur renvoie jusqu’à trois candidats franchissant ses contrôles ; l’UI
affiche tous les candidats reçus, sans exploiter actuellement le champ
`ambiguous` ou l’écart de scores. Prévoir une meilleure présentation du candidat
principal et des alternatives après calibration, sans masquer arbitrairement
les confusions. Suite : étendre progressivement l’index, mesurer la recherche
et tester aussi des cartes absentes, des impressions proches et des cartes physiques.

### 3 octobre 2026 — Pilote visuel PC sans lecture obligatoire du nom

- Capture explicite de la carte entière, aperçu vivant pendant l’analyse, propositions à confirmer. Pas encore de déclenchement automatique ni de file de scans multiples.
- Envoi JPEG au PC via Cloudflare explicitement autorisé ; traitement OpenCV ORB/RANSAC en RAM, sans API d’IA tierce ni photos conservées. Anciens modes locaux maintenus.
- Index pilote 411 empreintes (FR 119, EN 173, JP 119), distinct du catalogue plus large ; reconnaissance des cartes absentes non disponible. Aucun taux de précision garanti.
- 74 tests web, trois tests Python et syntaxe réussis. Cinq références publiques légèrement dégradées retrouvées : Raichu FR, Dracaufeu-ex FR, Charizard VMAX EN, Pikachu 001/SV-P JP et リザードンex JP. Pas de validation sur photos physiques ou benchmark indépendant.
- Nouveau lien HTTPS protégé vérifié à largeur téléphone, sans activer de caméra PC. Priorité au retour réel sur iPhone avant extension de l’index et OCR du numéro/extension. Roadmap ultime conservée.

### 2 octobre 2026 — Priorité utilisateur : scanner sans préparation et prix

- UI acceptée comme base ; perfectionnement visuel reporté. Prix et scan sans saisie d’un Pokémon prioritaires avant comptes/synchronisation.
- Mode automatique web : langue FR/EN/JP, lecture du bandeau par Tesseract.js 7 / WASM local, filtre des petits textes d’évolution, deux noms concordants, recherche de références, comparaison visuelle et confirmation humaine. Mode manuel conservé.
- Modèles `fra`/`eng`/`jpn` figés, empreintes et licences documentées ; aucun appel à une API de reconnaissance propriétaire, upload de frame ou corpus d’images téléchargé. Cache OCR distinct de la collection. Arrêt et annulation du worker même pendant l’initialisation.
- Limites conservées : 72 fiches par nom, images absentes, cadrage manuel, pas d’OCR du numéro/extension, noms limités au dictionnaire. Dresseurs/énergies/noms multiples et certaines écritures stylisées encore en recherche manuelle. Aucun taux de fiabilité garanti.
- Repères Cardmarket EUR / TCGplayer USD via TCGdex dans les fiches : métrique, variante, devise, date de la source, absence/ancienneté indiquées. Aucun prix EN substitué au JP. Langue/état non filtrés et correspondances parfois erronées : pas de valeur certifiée ni de total de portefeuille à ce stade.
- Collection et sauvegarde JSON v1 inchangées ; prix transitoires exclus des snapshots persistés/importés, coût d’achat séparé. Une erreur tarifaire n’empêche pas l’utilisation des métadonnées locales.
- 60 tests web réussis (cycles caméra/OCR synthétiques, prix, annulation, sécurité, IndexedDB). OCR réel vérifié dans le navigateur PC sur trois références publiques FR/EN/JP, pas sur caméra physique ; test Safari/iPhone encore à réaliser. Voir [protocole et limites](./scanner-web/README.md).

### 2 octobre 2026 — Refonte UX/UI web sobre et centrée sur les cartes

- Retour utilisateur : trop d'informations textuelles. Nouvelle direction ivoire/anthracite/vert doux, titres courts, pictogrammes SVG locaux et grille d'illustrations ; suppression du grand bloc d'introduction et des paragraphes permanents.
- Recherche compacte, langues FR/EN/JP en boutons à sélection visible, filtres nom/numéro/extension conservés. Navigation basse flottante avec scanner central ; position de défilement conservée par écran.
- Collection en grille avec pastilles de quantité ; coût unitaire et retrait dans les options du lot. Coût d'achat toujours distinct de la valeur de marché indisponible. Avertissement local court ouvrant un menu de sauvegarde complet, export/import toujours accessibles sans modifier leur format.
- Fiche compacte, boutons +/− pour les quantités, prix facultatif replié. Vérification de l'impression toujours obligatoire ; aucune migration de collection, modification de stockage ou de données existantes.
- Scanner allégé : cadrage visible, détails techniques repliés, couverture/missing references conservées. Cadre redimensionné sans changer le ratio carte ou le calcul de recadrage. Aide et sources dans une fenêtre dédiée ; ouvrir l'aide/sauvegarde arrête la caméra.
- 48 tests web réussis, dont huit scénarios du contrôleur d'interface (sélection de langue, quantité, navigation, fenêtres, confirmation, import et persistance). Vérifications navigateur à 390 × 844 et 320 × 700 : grille, fiche, sauvegardes, absence de débordement horizontal vérifiée ; bouton scanner dégagé de la navigation à 390 px. Essai physique iPhone de la nouvelle UI à poursuivre.
- Mise à jour des fichiers statiques sur le lien de test existant, sans relancer le tunnel ni changer l'origine de la collection. Pas de nouvelles dépendances d'exécution, de données inventées ou d'images générées.

### 2 octobre 2026 — Catalogue, scanner et collection réunis sur le web

- Navigation mobile Catalogue / Scanner / Collection. Catalogue TCGdex paginé par nom, numéro ou extension ; recherche française dans les catalogues EN/JP, langue et identité natives préservées. La limite de 72 fiches concerne le lot scanner, pas la recherche catalogue.
- Fiches réelles ; passage candidat visuel → fiche → vérification humaine obligatoire → ajout volontaire. Aucune finition déduite du visuel, aucun ajout automatique. Sortir du scanner ou ouvrir une fiche arrête la caméra sans effacer le lot préparé.
- Collection locale IndexedDB : quantités, langue, finition, état, coût unitaire facultatif en centimes ; regroupement des lots identiques. Confirmation de sauvegarde seulement après validation de la transaction. Pas de faux succès mémoire si le stockage échoue.
- Recherche locale française sur les cartes EN/JP ajoutées ; fiches sauvegardées consultables sans nouvelle requête lorsque la page est ouverte. Pas de PWA ni de garantie de chargement hors ligne ou d'images disponibles hors ligne.
- Sauvegarde JSON v1, aperçu et confirmation d'import additif par identifiant ; aucun remplacement des lots existants. Réimporter le même lot ne change pas sa quantité. Pas de CSV ni de migration Expo implémentés ; SQLite Expo reste intacte.
- Avertissement visible : données liées au navigateur et à l'origine. Exporter avant changement de domaine temporaire, garder le fichier hors du navigateur ; aucune synchronisation Firebase à ce stade. Coût d'achat et valeur de marché distingués, prix toujours indisponibles.
- 39 tests web réussis : domaine collection, transactions IndexedDB simulées (persistance, écritures concurrentes, annulation, données incompatibles), routes, file limitée de références et cycle caméra. Dépendance de test uniquement : fake-indexeddb 6.2.5 ; runtime toujours sans dépendance externe.
- Vérification de l'interface à 390 px sur PC : recherche japonaise via « Dracaufeu », ajout de deux exemplaires, coût de 25 €, rechargement et filtre français, import confirmé ajoutant un lot sans modifier le précédent. Export demandé par l'UI mais téléchargement non confirmé par le navigateur de test intégré ; vérifier le fichier dans Safari/Fichiers sur iPhone. Nouveau parcours physique iPhone encore à valider.

### 2 octobre 2026 — Web mobile prioritaire et premier retour utilisateur

- Décision utilisateur : conserver la base du scanner Safari et construire d'abord le produit complet pour le web. La décision d'une app native est reportée jusqu'à ce que le web fonctionne ; aucune compilation Apple/EAS ne bloque désormais le chemin de la V1.
- Retour d'un test physique utilisateur sur iPhone : le bon Raichu figurait parmi les trois candidats. L'utilisateur rapporte un résultat très rapide avec un petit lot et environ 2–3 secondes au-delà de 50 références. Ce sont des observations déclarées, pas une mesure instrumentée de latence ni un taux de précision.
- Principal problème remonté : références manquantes ou carte absente du lot. Ne pas confondre absence de correspondance et inexistence de la carte ; conserver le refus/confirmation humaine plutôt qu'une fausse certitude.
- Idée conservée pour plus tard : références vérifiées et index visuel compact distribués par versions/packs, après examen des droits et des budgets navigateur. Pas de téléchargement massif ni de cache permanent implémenté maintenant.
- Firebase et Cloudflare conservés ; développement local et tunnel temporaire de test déjà autorisé. Aucun nouveau projet cloud, compte, abonnement ou déploiement permanent créé par ce changement de cap.
- Projet Expo, code et données SQLite conservés sans suppression. Les fonctions catalogue/collection présentes dans Expo ne sont pas encore dans le web ; prévoir export/import volontaire et sauvegarde avant tout transfert.
- Plan et documentation mis à jour uniquement : pas de migration applicative ou de nouvelle fonction annoncée comme terminée.

### 2 octobre 2026 — Prototype de scanner Safari séparé

- Alternative web validée pour iPhone sans Mac ni compte Apple Developer payant. Application Expo et collection SQLite conservées intactes.
- Caméra arrière à la demande, analyse de frames en mémoire sans upload ni photo sauvegardée ; arrêt à la perte de focus document, fermeture, changement de lot et annulation d'autorisation tardive.
- Petit lot jusqu'à 72 fiches TCGdex FR/EN/JP, recherche par nom français, liens de secours identiques au mobile ; index visuel préparé dans le navigateur et couverture affichée.
- Première comparaison visuelle classique open source réelle, contrôle de qualité, quatre observations stables, ambiguïtés et candidats à vérifier. Pas d'OCR, redressement de perspective ou modèle appris ; pas de garantie de précision, pas de prix ni ajout automatique.
- Serveur local Node sans dépendance supplémentaire, accès par clé éphémère/cookie, proxy limité aux sources publiques approuvées, pas d'uploads, pas d'accès au workspace via HTTP, cache d'images en RAM plafonné. HTTPS iPhone à configurer ; tunnel uniquement après accord explicite.
- 22 tests web passent (dont contrôleur réel avec caméra/pixels synthétiques) ; 42 tests mobiles, TypeScript et lint passent. Le test physique Safari/iPhone et le benchmark de scans réels restent à effectuer.
- Rendu inspecté à largeur iPhone sur PC ; chargement réel des lots Dracaufeu FR (69 références/72 fiches, 4,1 s) et JP (40/50, 3,3 s), sans prétendre mesurer le téléphone. Lien HTTPS temporaire Cloudflare ouvert après accord explicite, protégé par clé de session ; binaire officiel 2026.9.3 installé uniquement dans le prototype, empreinte vérifiée. `npm run share` relance volontairement le test ; pas de service permanent ni compte distant créé.
- [Fonctionnement, limites, HTTPS et parcours de test](./scanner-web/README.md).

### 2 octobre 2026 — Préparation des tests natifs iPhone

- Appareil utilisateur confirmé : iPhone ; poste actuel Windows. `expo-dev-client` et profils EAS appareil/simulateur préparés ; aucun projet distant, certificat ou build cloud créé.
- Séparation des commandes Expo Go (`npm start`) et development build (`npm run start:dev`). Le scanner reste une démonstration : aucun accès aux frames ni modèle ajouté à cette étape.
- Installation de la version iOS à planifier selon l'accès à un Mac/Xcode ou à un compte Apple Developer payant pour EAS. Aucun achat ni abonnement demandé automatiquement.
- Prévoir export/import avant de transférer une collection réelle : SQLite Expo Go et SQLite de l'app dédiée ont des espaces distincts ; ne pas effacer Expo Go.
- Dépendances optionnelles alignées sur le SDK 57 sans installation forcée. 42 tests, TypeScript/lint et Expo Doctor 21/21 réussis ; introspection iOS validée. Audit npm : 19 alertes à examiner avant publication, pas de migration majeure automatique.
- [Méthodes, prérequis et protocole de test iPhone](./docs/BUILD_IOS.md).

### 1er octobre 2026 — Recherche multilingue depuis les noms français

- La langue sélectionnée est celle des cartes ; les noms français peuvent chercher les cartes des catalogues EN et JP.
- Dictionnaire PokéAPI local de 1 025 espèces FR/EN/JP (~48 Ko, licence incluse), sans API de traduction payante ni requête supplémentaire par recherche.
- Correspondance affichée, accents tolérés, suggestions françaises pour les noms partiels ; pas de sélection silencieuse parmi plusieurs espèces.
- Recherche locale de collection enrichie pour retrouver en français des cartes EN/JP sauvegardées, même hors ligne. Noms et identités des cartes inchangés.
- Cette étape ne traduit pas les extensions, dresseurs, attaques ou textes des cartes. Les noms composés et les qualificatifs de formes seront traités dans un prochain enrichissement.
- 40 tests de logique réussis, cinq recherches réelles et pagination validées, TypeScript/lint et exports Android/iOS réussis. Validation du rendu sur téléphone à effectuer.
- [Fonctionnement et test](./docs/SEARCH_LANGUAGES.md).

### 1er octobre 2026 — Complément japonais

- TCGdex reste prioritaire ; P-Collector fournit un index de liens TCGplayer JP pour le catalogue, les fiches et la collection existante.
- 5 012 correspondances sur 57 extensions ; 4 374 fiches sans URL d'image TCGdex complétées au moment de la génération. Index de 327 Ko, sans stockage d'images.
- Extension, numéro et nom japonais recoupés ; plusieurs images distinctes ou produits réutilisés pour d'autres impressions sont refusés. Aucune substitution FR/EN.
- Générateur séparé `images:refresh-jp`, rapport avec empreinte du catalogue source et protection contre une chute inattendue de couverture.
- 31 tests de logique réussis, six liens japonais testés en ligne, deux nouveaux visuels inspectés en plus du Dracaufeu témoin. TypeScript/lint et exports Android/iOS réussis ; rendu natif à valider sur téléphone.
- La couverture reste incomplète. Le dépôt type-null/PTCG-database et ses liens officiels japonais restent une piste à intégrer ultérieurement, après vérification des impressions et variantes.
- [Sources, limites et test sur téléphone](./docs/CARD_IMAGES.md).

### 1er octobre 2026 — Images de secours généralisées

- Croisement TCGdex → Malie → exceptions officielles Pokémon dans le catalogue, les fiches et les cartes déjà enregistrées.
- Générateur d'index à partir des exports TCGL récents et des archives PTCGO, avec associations explicites d'extensions et contrôles de langue, numéro et nom ; correspondances ambiguës refusées.
- 29 543 liens de secours indexés : 14 682 cartes FR et 14 861 EN. Parmi elles, 1 128 FR et 675 EN n'avaient pas d'URL d'image dans TCGdex lors de la génération.
- Index embarqué de 2,77 Mo ; aucune bibliothèque d'images hébergée. Les images restent chargées à distance. Le japonais reste couvert par TCGdex, sans substitution de langue.
- Dracaufeu DET1 5/18 désormais illustré via Malie. 30th-c-001 et 2024sv-1 restent sans correspondance dans les sources intégrées.
- 23 tests de logique réussis, 16 liens témoins testés en ligne et trois visuels inspectés, TypeScript/ESLint sans erreur et bundles Android/iOS exportés. Validation sur téléphone encore à effectuer ; l'ensemble des liens n'a pas été contrôlé individuellement.
- [Fonctionnement, rapport et actualisation](./docs/CARD_IMAGES.md).

### 29 septembre 2026 — Images de secours, pilote local

- TCGdex reste prioritaire ; secours par lien officiel Pokémon si l'image manque ou échoue.
- Cinq correspondances FR vérifiées : SM7.5 3, SM115 9, MEP 023/029/030. Aucun remplacement par une autre langue ou impression ; les autres manques ne sont pas encore couverts.
- Source de l'image affichée dans la fiche, visuel neutre et reprise manuelle si les liens échouent.
- Pas d'hébergement de bibliothèque d'images : liens distants et cache natif habituel uniquement.
- [Correspondances, limites et protocole de test](./docs/CARD_IMAGES.md). Confirmer les conditions d'utilisation des images avant publication et étendre progressivement la table validée.
- 18 tests de logique réussis, TypeScript/ESLint sans erreur et export du bundle Android réussi ; validation sur téléphone encore à effectuer.

### 29 septembre 2026 — Catalogue réel et collection persistante

- Catalogue TCGdex connecté en lecture : noms, numéros et extensions, français/anglais/japonais selon couverture de la source.
- Recherche paginée, attente limitée, annulation des requêtes obsolètes, erreurs et reprise manuelle.
- Fiches réelles avec images lorsqu’elles existent, langue, rareté et finitions disponibles.
- Ajout manuel avec finition, état et prix d’achat facultatif ; doublons regroupés par langue/état/finition/prix d’achat.
- Sauvegarde SQLite sur le téléphone, restauration au démarrage et consultation des fiches ajoutées hors ligne. Les images distantes ne sont pas garanties hors ligne.
- Collection personnelle vide au premier démarrage de cette version. Les anciens exemples du prototype n’étaient pas persistants ; les nouveaux exemples ajoutés via le scanner sont marqués « Démo » et exclus de la valorisation.
- Prix réels encore indisponibles : aucun prix fictif ni graphique inventé dans le tableau de bord personnel.
- Le compte Expo sert aux tests ; l’authentification TRACKTCG/Firebase et la synchronisation ne sont pas encore implémentées.
- [Plan de reconnaissance mis à jour](./docs/RECOGNITION.md) : TCG-AR reste une référence à adapter/benchmarker, pas un moteur mobile intégré. La suite du scan continu nécessite une development build native.
- Vérifications de cet incrément : 12 tests de logique réussis, recherches TCGdex réelles FR/EN/JP et pagination validées, TypeScript/ESLint sans erreur, Expo Doctor 21/21, exports des bundles Android et iOS réussis. La validation visuelle et de persistance sur téléphone reste à effectuer ; un export de bundle n’est pas un test natif sur appareil.

### 29 septembre 2026 — V1, incrément mobile initial

- Projet Android/iOS créé avec React Native, Expo SDK 57 et TypeScript strict.
- Navigation Expo Router avec Accueil, Collection, Scanner, Marché et Profil.
- Tableau de bord local, collection consultable et ajout d'une carte après confirmation.
- Flux caméra continu configuré sans animation de prise de photo ni conservation volontaire des frames.
- Permission caméra, lampe, cadre de scan et interface de résultat implémentés.
- Adaptateur Firebase préparé avec configuration par environnement ; aucun projet distant requis en développement local.
- Contrat `CardRecognitionEngine` créé pour isoler l'interface du futur moteur ArcFace/PaddleOCR.
- Parcours de scan actuellement alimenté par un résultat local de développement clairement signalé ; la reconnaissance réelle reste à intégrer.
- TypeScript, ESLint, Expo Doctor et bundle Android validés.

## Décisions validées

- Commencer par une première version centrée sur Pokémon.
- Prendre en charge les cartes françaises, anglaises et japonaises.
- Cibler d'abord les navigateurs mobiles sur iPhone et Android ; application native Android/iOS optionnelle après validation du web.
- Les utilisateurs finaux de TRACKTCG utilisent exclusivement un téléphone ; aucune application desktop n'est prévue pour le parcours collectionneur.
- Construire progressivement le produit jusqu'à une version multi-TCG complète.
- Utiliser uniquement des sources de prix et des images accessibles légalement par API, licence ou partenariat.
- Afficher une estimation transparente : valeur basse, valeur de marché, valeur haute, sources et date d'actualisation.
- Conserver une validation humaine lorsqu'une reconnaissance ou une estimation est incertaine.
- Utiliser Firebase pour le backend : Authentication, Cloud Firestore, Cloud Storage et fonctions serveur selon les besoins.
- Utiliser Cloudflare pour l'hébergement et la distribution des interfaces web.
- Garder le développement local et prévoir Firebase Local Emulator Suite ; le tunnel HTTPS temporaire explicitement autorisé reste un moyen de test, pas un hébergement de production.
- Employer un moteur spécialisé pour chaque tâche de vision plutôt qu'un modèle généraliste multimodal.
- Privilégier la fiabilité à la couverture : une image incertaine doit être refusée ou soumise à confirmation, jamais ajoutée silencieusement avec une fausse certitude.
- Le moteur de reconnaissance doit être entièrement open source, auto-hébergeable et utilisable sans API propriétaire facturée au scan.
- Aperçu caméra continu, capture temporaire manuelle acceptée depuis le 3 octobre pour analyser la carte entière ; déclenchement automatique à évaluer ensuite. Pas de galerie ni conservation par défaut. Envoi au PC uniquement dans le pilote explicitement autorisé, via Cloudflare.

## Architecture technique retenue

- Application web responsive conçue pour les téléphones, connectée à Firebase Authentication à intégrer. Safari/iPhone et Chrome/Android à valider sur appareils réels ; tests de développement sur PC possibles. Le scanner Safari existant est un prototype, pas encore le produit complet.
- Ajouter progressivement les éléments d'une PWA (manifest, installation lorsque disponible, cache contrôlé et comportements hors ligne testés). Ne pas promettre que caméra, stockage, installation ou arrière-plan se comportent comme une app native.
- Cloud Firestore pour les comptes, collections, transactions, alertes et données applicatives.
- Cloud Storage for Firebase pour les médias privés nécessaires au produit.
- Fonctions serveur pour protéger les clés des fournisseurs et orchestrer les traitements externes.
- Cloudflare pour l'interface web collectionneur, le site public et l'administration. Adapter et sécuriser le proxy de références pour l'environnement Cloudflare avant un déploiement permanent ; le serveur Node local actuel n'est pas directement un backend de production prêt à héberger.
- Firebase Local Emulator Suite pour Auth, Firestore, Storage et Functions pendant le développement local.
- Environnements strictement séparés : local, test et production.
- Exécuter autant que possible la détection, le redressement, l'empreinte visuelle, l'OCR et la recherche d'identité directement sur le téléphone.
- N'envoyer à Firebase que l'identifiant final, les choix de l'utilisateur et les données de collection ; les frames de caméra restent en mémoire locale par défaut.
- Exception de prototype autorisée : capture JPEG au PC Windows via Cloudflare pour un moteur visuel local ; ce service Python n’est pas hébergé dans Firebase/Cloudflare Workers. Le choix de déploiement de la reconnaissance sera réévalué après benchmark, sans élargir silencieusement l’envoi de photos.
- Distribuer ultérieurement les modèles et l'index de reconnaissance en versions téléchargeables et actualisables, avec quotas, éviction et erreurs de stockage navigateur gérés. Téléchargement d'images haute résolution facultatif, pas systématique.
- Prévoir une collection locale web persistante, sauvegardes/export et synchronisation Firebase ; ne pas dépendre d'un stockage navigateur supposé permanent. Préserver la collection SQLite Expo jusqu'à transfert volontaire testé.

### Chaîne de reconnaissance spécialisée

Chaîne cible de la version avancée, distincte du pilote ORB actuel :

1. Aperçu continu de la caméra ; capture explicite de la carte entière ou sélection automatique quand validée.
2. Sélection temporaire en mémoire de quelques frames nettes et stables ; aucune conservation par défaut.
3. Contrôle de qualité : netteté, exposition, reflets et carte entièrement visible.
4. Détection et rectification géométrique de la carte avec un composant spécialisé.
5. Identification visuelle de l'illustration avec un moteur dédié aux cartes à collectionner.
6. Lecture spécialisée du numéro de collection, du code d'extension et de la langue par OCR.
7. Fusion des preuves issues de plusieurs frames visuelles et textuelles pour résoudre l'impression exacte.
8. Détection séparée de la finition à partir de plusieurs angles lorsque cela devient suffisamment fiable.
9. Confirmation utilisateur pour les réimpressions, finitions ou variantes impossibles à distinguer avec certitude.

La base de référence à évaluer est une adaptation Pokémon open source d'ArcFace inspirée de TCG-AR. Le projet source vise un PC avec GPU ; l’adaptation mobile n’est pas encore réalisée ni validée. Elle sera combinée à un détecteur de carte, un moteur d'orientation et un OCR spécialisés. TinEye et les autres API propriétaires de reconnaissance sont exclus de l'architecture. Chaque composant et chaque poids de modèle devront passer un audit de licence avant intégration. Le modèle final ne sera validé qu'après un benchmark reproductible en conditions réelles. Voir `docs/RECOGNITION.md` pour les limites et l’ordre des travaux.

### Seuil de qualité du scanner

- Construire un jeu de test indépendant avec cartes françaises, anglaises et japonaises.
- Inclure cartes raw, sleeves, holo/reverse, faible lumière, reflets, inclinaison, arrière-plans complexes et appareils mobiles variés.
- Mesurer séparément détection, identification de la carte, impression exacte, langue et finition.
- Exiger au moins 99,5 % de précision sur les résultats automatiquement acceptés.
- Autoriser le moteur à refuser les images insuffisantes afin de préserver cette précision.
- Afficher jusqu'à trois propositions lorsqu'une confirmation est nécessaire.
- Ne jamais présenter le score interne d'un modèle comme une probabilité garantie sans calibration sur des photographies réelles.

## Phase 0 — Cadrage et fondations

- Définir le nom, l'identité visuelle et le public cible.
- Rédiger les parcours utilisateur et les maquettes principales.
- Finaliser l'architecture web mobile autour de Firebase et Cloudflare, en conservant les moteurs spécialisés et la confidentialité du flux caméra.
- Identifier les catalogues Pokémon et les sources tarifaires autorisées.
- Définir le modèle de données : carte, extension, variante, langue, état, exemplaire, prix et transaction.
- Préparer la sécurité, les sauvegardes, le RGPD et la politique de confidentialité.
- Définir les critères mesurables de reconnaissance et de qualité des prix.

Livrable : cahier des charges technique et fonctionnel validé.

## Phase 1 — MVP Pokémon

- Création de compte et connexion.
- Application web mobile utilisable sur iPhone et Android ; installation PWA progressive selon les capacités du navigateur, sans dépendance à une build native pour le MVP.
- Catalogue Pokémon français, anglais et japonais.
- Recherche par nom, numéro, extension et filtres.
- Recherche des noms Pokémon français dans les catalogues anglais et japonais ; conserver la langue et l'impression réelles de chaque carte.
- Scan d'une carte avec recadrage automatique.
- Reconnaissance du nom, de l'extension et du numéro.
- Proposition de plusieurs résultats en cas d'incertitude.
- Confirmation manuelle de la langue, de la variante et de l'état.
- Fiche détaillée avec image, rareté, extension et données de prix.
- Valeur basse, marché et haute avec sources et date de mise à jour.
- Collection personnelle, quantités, prix d'achat, date d'achat et notes.
- Tableau de bord : valeur totale, coût d'achat et plus-value ou moins-value.
- Graphiques d'évolution.
- Liste de souhaits et alertes de prix.
- Import et export CSV.
- Interface d'administration pour corriger le catalogue et les correspondances.
- Outils de signalement des erreurs par les utilisateurs.

Critères de sortie : application web stable sur les navigateurs mobiles ciblés, collection persistante sauvegardable, prix traçables et reconnaissance suffisamment fiable sur un jeu de test représentatif. La signature Apple et la publication sur un store ne sont pas des critères de sortie du MVP.

## Phase 2 — Qualité du scan et gestion avancée

- Enrichir la recherche multilingue avec les formes régionales, noms composés et qualificatifs ex/GX/V ; étudier séparément la traduction des extensions, dresseurs et textes, sans inventer de correspondance.
- Scan en série de plusieurs cartes.
- Détection améliorée des variantes : holo, reverse, promo, première édition et éditions spéciales.
- Détection des doublons.
- Reconnaissance des cartes gradées et lecture des étiquettes PSA, BGS, CGC et TAG.
- Estimation assistée de l'état, toujours confirmée par l'utilisateur.
- Photos personnelles recto et verso.
- Collections multiples, classeurs, boîtes, emplacements et tags.
- Progression de complétion des extensions et liste des cartes manquantes.
- Synchronisation hors ligne et reprise automatique.

## Phase 3 — Prix et analyses avancés

- Agrégation de plusieurs sources tarifaires autorisées.
- Séparation des ventes conclues et des annonces actives.
- Nettoyage des valeurs aberrantes et indice de confiance du prix.
- Historique détaillé des prix.
- Valeurs spécifiques à la langue, la variante, l'état et la note de grading.
- Population des cartes gradées lorsque les données sont disponibles.
- Conversion multidevise.
- Calcul de la valeur nette après frais de marketplace.
- Gains réalisés et non réalisés.
- Rapports par jeu, extension, rareté, langue et période.
- Résumés hebdomadaires et alertes de mouvements importants.

## Phase 4 — Échanges et marché

- Analyseur d'échange avec deux côtés.
- Prise en compte des cartes, variantes, états, grading et compléments en argent.
- Indicateur d'équité et avertissements sur les prix peu fiables.
- Sauvegarde et partage des échanges.
- Comparateur d'annonces externes.
- Enchères se terminant bientôt et alertes de bonnes affaires.
- Suivi des achats et des ventes.
- Calcul des bénéfices nets.
- Liens partenaires vers les marketplaces.
- Étude d'une marketplace interne avant toute intégration des paiements.

## Phase 5 — Extension multi-TCG

- Ajouter progressivement Magic: The Gathering.
- Ajouter Yu-Gi-Oh!.
- Ajouter One Piece Card Game.
- Ajouter Disney Lorcana.
- Ajouter ensuite les autres TCG selon la demande et la disponibilité des données.
- Adapter le moteur de variantes et de prix aux règles de chaque jeu.
- Ajouter les produits scellés : boosters, displays, coffrets et éditions spéciales.

## Phase 6 — Communauté

- Profils publics ou privés.
- Vitrine de collection partageable.
- Publications, abonnements, commentaires et réactions.
- Comparaison facultative des collections.
- Classements optionnels respectueux de la confidentialité.
- Signalement, modération et outils anti-fraude.

## Phase 7 — Version ultime

- Reconnaissance multi-TCG très rapide, y compris par lots.
- Assistant intelligent capable d'expliquer une estimation.
- Détection avancée des défauts visibles et aide au pré-grading, sans promettre une note officielle.
- Couverture mondiale des langues, variantes, cartes brutes, gradées et produits scellés.
- Données de marché transparentes et mises à jour fréquemment.
- Recommandations personnalisées et détection d'opportunités selon les préférences de l'utilisateur.
- Analyse complète du portefeuille, fiscalité exportable selon le pays et historique des transactions.
- Échanges sécurisés et, si le cadre légal et opérationnel le permet, marketplace intégrée.
- API publique et intégrations avec boutiques, professionnels et outils de gestion de stock.
- Fonctions professionnelles dans la version web principale.
- Application native Android/iOS uniquement si l'utilisateur confirme ensuite son intérêt, après validation du web ; réutiliser le métier et les données autant que possible.

## Fonctions transversales permanentes

- Sécurité, chiffrement, sauvegardes et authentification à deux facteurs.
- Conformité RGPD, export et suppression des données.
- Accessibilité et thèmes clair et sombre.
- Tests automatiques et contrôle qualité sur Safari/iPhone et Chrome/Android, puis autres navigateurs retenus ; tests natifs uniquement si cette version est décidée.
- Mesure de la précision du scan et de la fraîcheur des prix.
- Administration, modération, suivi des erreurs et journal des modifications.
- Modèle gratuit utilisable et abonnement Premium pour les fonctions avancées.

## Ordre de travail

Mise à jour du 7 octobre : index élargi à 2 000 et test WebP réalisés (bilan
ci-dessus). Prochain jalon : scans iPhone indépendants présents/absents et
impressions proches avant nouvelle extension massive ou stockage distant.

Décision du 3 octobre 2026 après échec de capture/OCR sur iPhone : priorité à
un parcours carte entière → capture → propositions, sans nom à préparer ou à
lire obligatoirement. Analyse PC via Cloudflare explicitement autorisée,
sans conservation de photos ni API d’IA tierce. Pilote OpenCV ORB/RANSAC activable
séparément ; 411 empreintes FR/EN/JP, pas un index catalogue complet ni un
moteur neuronal de la version ultime. Ancien OCR/manual conservés en secours.
Aperçu vivant pendant traitement, pas encore de capture automatique/file de scans.
74 tests web, contrôles Python et références publiques ; essais physiques requis.

Suite immédiate : valider des cartes physiques présentes/absentes de l’index
sur iPhone (dont Pikachu 001/SV-P), mesurer latence totale/refus/confusions,
étendre un index versionné de références exactes après ces retours ; intégrer
OCR numéro/extension pour les impressions proches, puis comparer les moteurs
spécialisés sur un jeu indépendant. Ce pilote ne clôture pas la reconnaissance
universelle et ne modifie pas la roadmap ultime, Firebase ou l’hébergement prévu.

Incrément du 3 octobre 2026 : lecture séparée espèce/suffixe, recherche native
ex/GX/V/VMAX/VSTAR/V-UNION/BREAK/LV.X et filtre des variantes avant indexation.
Suffixes collés ou petits pris en compte ; V ne confirme pas VMAX. Suffixe
inconnu ne signifie pas carte normale. EX ancien et ex moderne regroupés ;
numéro/extension à intégrer avant identification autonome de l’impression.
Secours sur capture FR/EN par accord exact de deux traitements du titre ciblé,
sans correction approximative ni garantie de fiabilité. JP : suffixe large
revérifié, logos encore expérimentaux. 71 tests web réussis, pas un benchmark
physique. Prochaine validation : cartes ex/VMAX sur iPhone avec « Figer et analyser ».
Essai de référence PC : Dracaufeu-ex FR reconnu avec suffixe et fiche retrouvée ;
Charizard VMAX EN encore non résolu (faux V d’évolution refusé), リザードン JP
reconnu sans ex. Reconnaissance de logos spécialisée à évaluer si ces limites
se confirment sur téléphone, en complément du numéro et de l’index visuel.

Retour et incrément du 2 octobre 2026 : FR/EN utilisables sur iPhone mais cadrage
exigeant ; aucun succès automatique JP rapporté, exemple Pikachu 001/SV-P.
Ajout d’une capture « Figer et analyser » en mémoire uniquement, caméra arrêtée
avant OCR/réseau, et capture automatique après confirmation du nom. Comparaison
unique du cliché sans simuler une stabilité temporelle. JP : cadrage ciblé du
titre, filtrage kana et essais de secours bornés (traits sombres/bandeau élargi).
L’échec a été reproduit sur la référence Pikachu, puis le nom reconnu sur PC ;
le scanner physique JP n’est donc pas déclaré validé. 68 tests locaux passent.
Prochaine validation : nouvelles captures FR/EN et Pikachu 001/SV-P sur iPhone,
puis mesure séparée démarrage OCR/lecture/références/comparaison.

Le changement de plateforme ne valide pas automatiquement les fonctions déjà
codées dans Expo pour le web. Ordre des prochains incréments :

1. **Interface web mobile unifiée — implémentée, validation téléphone à poursuivre** : scanner, catalogue FR/EN/JP, recherche française et fiches réunis ; distinguer fonctions présentes et futures.
2. **Collection web persistante — implémentée localement, validation Safari à poursuivre** : ajout confirmé, exemplaires/langue/finition/état/coût, IndexedDB et export/import JSON. Expo préservé ; migration volontaire non implémentée. Aucun stockage navigateur ne remplace une sauvegarde externe.
3. **Prix — repères implémentés, valorisation exacte à poursuivre** : Cardmarket/TCGplayer via TCGdex, source/devise/date/variante ; améliorer correspondances et prix propres à langue/état, intégrer une source JP qualifiée avant total de portefeuille.
4. **Scanner automatique — première lecture du nom implémentée, validation téléphone à poursuivre** : plus de Pokémon à préparer en mode automatique ; mesurer sur appareils, puis OCR numéro/extension, cadrage/redressement et fusion. Références/index téléchargeables conservés pour plus tard.
5. **Comptes et synchronisation Firebase** : émulateurs locaux, règles d'accès et conflits ; projets distants uniquement après autorisation.
6. **PWA et publication Cloudflare** : installation/hors-ligne progressifs, limites navigateur, sécurité et adaptation des routes ; déploiement permanent après validation et autorisation.
7. **Roadmap ultime** : continuer les phases avancées ci-dessus. Évaluer une app native seulement lorsque l'utilisateur le décide.

Décision du 2 octobre 2026 : la conservation de la collection de test n'est pas
prioritaire et ne bloque pas les relances du prototype. Priorité au scanner
automatique et aux prix ; le backend Firebase sera traité ensuite. Aucune donnée
existante n'est supprimée pour cette décision. Le prototype relancé a été vérifié
via son lien HTTPS : mode automatique accessible sans nom saisi et repères de
marché affichés dans une fiche. Le scan réel sur iPhone reste à valider.

Une phase n'est considérée terminée que lorsque ses fonctions sont développées, testées et validées. Les nouvelles idées seront ajoutées à ce document avant d'être développées afin d'éviter de perdre la vision de la version ultime.
