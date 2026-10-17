# Banc OCR CPU — 7 octobre 2026

Expérimentation séparée du scanner public : aucun changement de serveur,
d'index ORB, d'interface ou de décision de reconnaissance. Pas de GPU utilisé.
Le PC est uniquement un poste de développement. Contrainte utilisateur finale :
téléphone + Cloudflare, Firebase facultatif pour comptes/profils/données ; aucun
VPS ni serveur de reconnaissance dédié. Ce banc Python ne sera donc pas simplement
hébergé ailleurs. Il sert à comparer des lecteurs avant un éventuel portage
compatible navigateur. Sans déploiement ni création de ressource par ce test.

## Résultats obtenus

Médianes de trois lectures à chaud en millisecondes. « OK » signifie numéro
compatible selon le protocole ci-dessous, **pas carte identifiée avec certitude**.
La largeur ne compte pas les 20 px de marge blanche.

| Entrée | Largeur | Tesseract | Paddle serveur | Paddle léger EN |
| --- | ---: | --- | --- | --- |
| Photo Pikachu JP, réduite | 900 | Refus / 349 | 001/SV-P / 13 127 | Refus / 3 136 |
| Même photo, native | 1492 | Refus / 291 | 001/SV-P / 15 255 | 001/SV-P / 3 528 |
| FR base1-14 | 600 | Refus / 134 | Refus / 11 925 | Refus / 2 818 |
| EN swsh3-20 | 734 | OK / 223 | OK / 13 888 | OK / 2 970 |
| JP SV2a-003 | 600 | Refus / 205 | Refus du parseur / 9 672 | OK / 2 050 |
| FR swsh2-3 | 734 | Refus / 126 | OK / 12 935 | OK / 2 810 |
| EN bw7-3 | 734 | Refus / 156 | OK / 10 171 | OK / 2 131 |
| JP SM12a-005 | 287 | Refus / 39 | Conflit / 9 264 | Refus / 1 717 |

Les quatre passages par entrée donnent le même statut et la même référence.
Rapport final sans erreur de téléchargement/exécution : huit entrées pour
sept images distinctes, pas huit photos indépendantes. Les deux lecteurs
Paddle ont chacun cinq entrées compatibles, mais pas les mêmes ; cela ne
constitue pas un taux de reconnaissance du catalogue.

Constats utiles :

- Le lecteur léger retrouve **001/SV-P à taille native**, mais pas après
  réduction à 900 px. Préserver les pixels avant localisation mérite donc
  une validation élargie. Ce résultat ne prouve pas un besoin général de 1492 px.
- Le lecteur serveur lit `003/165RR` : notre parseur conservateur refuse les
  lettres accolées. C'est une limite d'interprétation distincte de la lecture.
- Sur la petite référence SM12a-005, il lit `C005/173` au lieu du numéro 005.
  Aucune correction forcée d'après la réponse attendue, conflit conservé.
- La variante légère prend ici 1,72–3,53 s par bandeau ; elle ne justifie pas
  de ralentir toutes les recherches ORB qui fonctionnent déjà rapidement.
- Les résultats sont conditionnés par le backend CPU standard de secours.
  Ils ne permettent pas de conclure qu'un moteur est le meilleur disponible.

**Décision : pas d'activation sur le téléphone.** Prochaine étape, corrigée
après la précision d'architecture : vérifier un export/runtime navigateur
compatible et mesurer sur Safari/iPhone, localiser davantage
les zones utiles sans introduire la réponse attendue, puis évaluer sur un lot
indépendant de captures physiques FR/EN/JP, inconnues et impressions proches.
L'OCR restera une vérification conditionnelle, pas une attente systématique.
89 tests web, sept tests Python et contrôles de syntaxe réussis. Index 2 000
inchangé (SHA-256 enregistré dans le rapport).

## Protocole reproductible

- Windows, Intel i5-14400F, Python 3.13, Node 22.18.0.
- Environnement `.tools/ocr-cpu-env`, distinct de `.tools/visual-env` en service.
  Dépendances exactes : `ocr-cpu-requirements.txt` ; `pip check` réussi.
- PaddleOCR 3.4.1 / PaddlePaddle CPU 3.3.0 / PaddleX 3.4.3 : détecteur
  `PP-OCRv5_mobile_det`, lecteur `PP-OCRv5_server_rec`, puis
  `en_PP-OCRv5_mobile_rec`. Ce dernier lit les chiffres/codes latins, pas les
  noms japonais. Quatre threads CPU configurés, aucune rotation/unwarping IA.
- Tesseract.js 7.0.0, `eng/4.0.0_best_int`, PSM 6, WASM dans Node. Même modèle
  que le lecteur de numéros du navigateur, **pas le même runtime ni les mêmes
  trois traitements que le diagnostic Safari**.
- Une photo utilisateur d'écran (Pikachu JP), à largeur 900 puis native 1492 ;
  six images de référence publiques, dont trois cartes supplémentaires choisies
  à l'avance à 57 % des références de chaque langue de l'index figé.
- Bas de l'image (20 %) découpé automatiquement, largeur limitée à 1500 sans
  agrandissement, bord blanc de 10 px. Même PNG transmis aux deux lecteurs.
  **Pas d'homographie**, de boîte du numéro annotée, de carte attendue, de
  dictionnaire de réponses ou de référence transmise aux moteurs OCR.
- Un premier passage puis trois répétitions chaudes ; médiane des trois temps.
  Chaque répétition relit la même image : ce ne sont pas des observations
  indépendantes. Les temps excluent réseau, capture, préparation et recherche
  visuelle. Démarrage séparé ; premier téléchargement éventuellement inclus
  dans l'initialisation Paddle, donc non comparable à un démarrage à cache chaud.
- Extraction prudente d'une fraction/code promo explicite, jamais d'un nombre
  nu ni de substitution O/0. Tesseract : mots de confiance >=55 ; Paddle :
  lignes >=0,8. Échelles **non calibrées entre moteurs**, textes bruts conservés.
  Lectures contradictoires refusées. Les attentes ne servent qu'au bilan après
  OCR. Pour les six références, seul le numérateur est évalué ; le dénominateur
  n'est pas une vérité terrain annotée. Aucune preuve d'impression exacte.
- Les pixels ne sont ni sauvegardés ni téléversés. Le rapport JSON ne contient
  que résultats textuels, temps, dimensions et identifiants. Les poids restent
  dans `.tools/ocr-models` ignoré par Git, pas distribués dans le site.

Résultats bruts : [ocr-cpu-report.json](data/ocr-cpu-report.json).
Petit test de faisabilité, **pas une mesure de précision générale** : une seule
photo réelle, références numériques pour le reste, pas de négatifs réels, pas
de mesures iPhone, serveur de production ou montée en charge. Les références
testées auparavant appartiennent au lot de réglage, pas au test indépendant.

## Rejouer volontairement

Depuis `scanner-web`, après installation de Python 3.13 et des dépendances npm :

```powershell
python -m venv .tools/ocr-cpu-env
./.tools/ocr-cpu-env/Scripts/python.exe -m pip install --only-binary=:all: -r visual/ocr-cpu-requirements.txt
npm run ocr:benchmark:cpu -- "--photo=C:\chemin\photo.jpg"
```

Photo JPEG <=3 Mio / 5 mégapixels ; aucune copie au dépôt. Cette commande
écrase le rapport précédent, pas la photo. Accès réseau requis pour télécharger
les références publiques et les poids manquants, pas pour l'inférence elle-même.
Le nom local de la photo n'est pas écrit dans le rapport. Un échec réseau est
enregistré, jamais compté comme une lecture réussie.

## Runtime et provenance

La tentative oneDNN a échoué sous Windows avec
`ConvertPirAttribute2RuntimeAttribute ... ArrayAttribute<DoubleAttribute>`.
Le banc a donc explicitement désactivé MKL-DNN et utilisé le CPU standard.
Ces temps ne décrivent **pas** les meilleures performances CPU possibles.
Le défaut est aussi signalé dans le
[dépôt PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR/issues/17869).
Une version/runtime CPU compatible ou un export ONNX reste à comparer, sans
changer les images ni les critères de lecture et sans dégrader la précision.

Sources des poids : compte officiel
[PaddlePaddle](https://huggingface.co/PaddlePaddle/PP-OCRv5_server_rec),
[lecteur léger anglais](https://huggingface.co/PaddlePaddle/en_PP-OCRv5_mobile_rec),
[détecteur léger](https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det).
Détecteur initialement téléchargé depuis le serveur officiel BOS indiqué dans
le code PaddleX ; lecteur serveur depuis Hugging Face, révision
`b26c3587fda8da3c8ec0ce357214b4d661ff1558`.
Les fiches des trois modèles indiquent Apache-2.0 ; empreintes SHA-256 des
poids et configurations dans [le manifeste](data/ocr-models-manifest.json).
Lecteur léger : révision `267c36e24c331595590fe7bd72bde2436fd286f2`.
Audit complet des dépendances,
notices et droits des images requis avant redistribution/production ; licence
du moteur ne signifie pas licence de redistribution des illustrations Pokémon.

Documentation API utilisée :
[PaddleOCR 3.4.1](https://www.paddleocr.ai/v3.4.1/en/version3.x/pipeline_usage/OCR.html).
