# Images : croisement TCGdex / Malie / Pokémon officiel / P-Collector JP

## Complément japonais — 1er octobre 2026

Le nouvel index contient **5 012 correspondances japonaises sur 57 extensions**,
dont **4 374 fiches sans URL d'image TCGdex** lors de la génération. Il utilise
le catalogue public [P-Collector Card DB](https://github.com/posmap-japan/p-collector-card-db)
pour trouver des liens du CDN TCGplayer. Les liens TCGdex déjà présents dans ce
catalogue sont exclus : ils ne constituent pas une source de secours indépendante.

`expo-app/src/data/japanese-image-index.json` contient uniquement nom japonais,
numéro et suffixe du lien distant, **326 610 octets (~327 Ko)**. TCGdex garde
la priorité ; le secours est disponible dans le catalogue, les fiches et la
collection déjà sauvegardée. La mention « Image : TCGplayer JP » identifie le
visuel de secours réellement chargé. Aucun compte ni clé d'API supplémentaires.

Le [rapport japonais](../expo-app/src/data/japanese-image-index-report.json)
conserve les volumes par extension, la date et le SHA-256 du fichier source.
L'extension doit correspondre exactement, y compris sa casse. Le numéro tolère
uniquement les zéros initiaux numériques ; les préfixes sont conservés. Le nom
est normalisé en Unicode NFKC, sans supprimer ponctuation, marques de kana,
genres ni suffixes ex/GX/V. À l'affichage, nom et numéro doivent encore être ceux
de TCGdex. Plusieurs liens distincts pour la même identité, ou un même produit
réutilisé pour des numéros/extensions différents, sont refusés.

Six liens témoins ont répondu HTTP 200, image/jpeg, après recoupement avec les
fiches TCGdex : SM6a-003, SM8b-001, SM10-007, SM3H-011, SM12-001 et SM4S-001.
Dracaufeu SM6a 003/053 a été inspecté pendant la recherche ; Bulbizarre SM8b
001/150 et Reshiram & Dracaufeu GX SM10 007/095 pendant l'intégration. La priorité
TCGdex a été vérifiée sur SV2a-001. **Les 5 012 images n'ont pas toutes été
inspectées visuellement** ; une correspondance de métadonnées ne garantit pas
la finition (holo/reverse) ni l'absence d'erreur dans la source.

La couverture reste partielle, notamment pour les cartes anciennes PMCG.
Les images témoins font 287 × 400 px : adaptées à l'affichage, pas une validation
pour entraîner le scanner. Le dépôt
[type-null/PTCG-database](https://github.com/type-null/PTCG-database), qui référence
des liens officiels pokemon-card.com, reste une piste **non intégrée** pour un
prochain élargissement avec contrôle des impressions et variantes. Aucun lien
officiel japonais n'est deviné à partir du nom ou du numéro.

Le code/schéma du dépôt P-Collector est annoncé MIT ; cette licence ne rend pas
les illustrations libres de droits. Les conditions des sources d'images restent
à valider avant publication. Les fichiers sont lus comme des données, sans
exécuter le code du dépôt. L'application ne contacte pas GitHub à l'affichage.

## Généralisation — 1er octobre 2026

L'index embarqué contient **29 543 correspondances** : 14 682 FR et 14 861 EN.
Il apporte des liens à 1 128 fiches françaises et 675 fiches anglaises qui
n'avaient pas d'URL d'image dans la réponse TCGdex du jour. Ces nombres sont des
correspondances de catalogue, pas une garantie que chaque lien restera joignable.

Les sources consultées sont 54 fichiers langue/extension de l'export TCGL Malie
et 71 listes historiques PTCGO. Les listes couvrent notamment les séries
HeartGold/SoulSilver, Noir & Blanc, XY, Soleil et Lune et Épée et Bouclier.
Les exports récents couvrent Écarlate et Violet et Méga-Évolution, selon les
cartes disponibles. Les galeries disposent de correspondances séparées.

Le fichier `expo-app/src/data/card-image-index.json` contient uniquement nom,
numéro et chemin du lien distant, environ **2,77 Mo** au total. Aucune image
n'est embarquée. Il est consulté immédiatement en mémoire : aucune recherche
Malie supplémentaire n'est faite à l'ouverture d'une ligne ou d'une fiche.
Les images sont téléchargées à l'affichage par le composant natif.

Le [rapport généré](../expo-app/src/data/card-image-index-report.json) détaille
la date, les volumes et les correspondances par extension/source.

## Fonctionnement

Les métadonnées, identifiants et langues restent ceux de TCGdex. Le résolveur
`expo-app/src/services/card-images.ts` sélectionne les liens pour tous les usages
de `CardArtwork` (catalogue, fiche, collection). Aucun changement de collection
ni réimport n'est nécessaire pour les cartes déjà enregistrées.

1. Essayer l'image TCGdex si une URL existe.
2. Si elle manque ou si son chargement échoue, essayer le lien Malie (FR/EN)
   ou TCGplayer via P-Collector (JP) de l'index correspondant.
3. Si nécessaire, essayer le lien officiel validé pour l'impression exacte,
   lorsqu'une exception du pilote existe.
4. Sans correspondance ou après échec des liens, garder un visuel neutre.
   La grande fiche affiche « Image indisponible » et permet de réessayer après
   une erreur réseau. Pas de boucle de requêtes automatique.

La source de l'image réellement chargée apparaît sous le visuel de la fiche.
Une nouvelle carte ou une nouvelle URL réinitialise les erreurs de chargement.
Les correspondances des exports récents nécessitent une extension explicitement
associée, la même langue, le même numéro et le même nom. Les zéros numériques
initiaux sont normalisés pendant la construction (001 et 1) ; les préfixes
TG/GG/SM sont conservés. Les cartes jumbo sont exclues. Plusieurs finitions qui
partagent le même visuel peuvent utiliser ce visuel ; plusieurs images distinctes
pour une correspondance sont refusées. Le visuel ne certifie pas la finition.

Pour les archives PTCGO, les titres sont en anglais : l'identité est recoupée
avec le numéro et le nom de la fiche TCGdex anglaise de cette même extension,
puis le lien de la langue demandée est sélectionné. Au moment d'afficher, nom,
numéro et langue de la carte doivent encore correspondre à l'index embarqué.

Les cartes japonaises utilisent TCGdex puis le complément P-Collector décrit
ci-dessus. Les sources Malie consultées ne proposent pas de couverture japonaise ;
aucune image française ou anglaise n'est utilisée à la place d'une carte japonaise.

L'application ne consulte pas les pages HTML Pokémon. Le générateur lit les
listes de références Malie uniquement au moment d'actualiser l'index.

## Exceptions officielles du pilote — 29 septembre 2026

Les cinq URL ont répondu HTTP 200, `image/png`. Les quatre nouvelles images ont
été inspectées visuellement dans le navigateur ; SM75 a été confirmé par
l'utilisateur. Identifiants, numéros et noms recoupés avec l'API TCGdex FR.

| Identifiant TCGdex FR | Impression | Image officielle |
| --- | --- | --- |
| `sm7.5-3` | Dracaufeu, Majesté Des Dragons, 3 | [SM75_FR_3.png](https://assets.pokemon.com/static-assets/content-assets/cms2-fr-fr/img/cards/web/SM75/SM75_FR_3.png) |
| `sm115-9` | Dracaufeu-GX, Destinées Occultes, 9 | [SM115_FR_9.png](https://assets.pokemon.com/static-assets/content-assets/cms2-fr-fr/img/cards/web/SM115/SM115_FR_9.png) |
| `mep-023` | Méga-Dracaufeu X-ex, promo 023 | [MEP_FR_23.png](https://assets.pokemon.com/static-assets/content-assets/cms2-fr-fr/img/cards/web/MEP/MEP_FR_23.png) |
| `mep-029` | Méga-Dracaufeu X-ex, promo 029 | [MEP_FR_29.png](https://assets.pokemon.com/static-assets/content-assets/cms2-fr-fr/img/cards/web/MEP/MEP_FR_29.png) |
| `mep-030` | Méga-Dracaufeu Y-ex, promo 030 | [MEP_FR_30.png](https://assets.pokemon.com/static-assets/content-assets/cms2-fr-fr/img/cards/web/MEP/MEP_FR_30.png) |

Depuis la généralisation, `det1-5` dispose également d'un lien Malie FR vérifié
en ligne et visuellement. `30th-c-001` et `2024sv-1` restent sans correspondance
dans les sources intégrées. Les cartes et extensions absentes ou ambiguës
restent affichées avec le visuel neutre lorsqu'elles n'ont pas d'image TCGdex.

## Actualiser l'index

Depuis `expo-app/` :

```powershell
npm run images:refresh
npm run images:refresh-jp
npm test
npm run test:images-live
npm run test:images-jp-live
npx tsc --noEmit
npm run lint
```

Le générateur télécharge seulement des métadonnées JSON et des listes HTML
publiques, avec trois requêtes simultanées au maximum. Il reconstruit l'index
et son rapport après la fin des lectures. Les images ne sont pas téléchargées.
Les correspondances d'extensions sont explicites dans le script ; une nouvelle
extension doit être vérifiée avant d'ajouter son association.

Le générateur japonais est indépendant du générateur FR/EN : deux catalogues
JSON sont lus en parallèle, sans télécharger d'images. Il refuse de remplacer
l'index si moins de 100 correspondances restent ou si sa couverture baisse de
plus de 20 % par rapport à l'instantané précédent ; les anciennes données sont
préservées et la source doit être examinée. L'actualisation n'est pas automatique.

## Stockage, limites et suite

- Seulement des liens dans le code ; aucune bibliothèque d'images hébergée chez
  nous. Le téléphone télécharge les images à l'affichage et peut utiliser le
  cache natif habituel. Aucun téléchargement massif ni cache permanent ajouté.
- Les images officielles vérifiées mesurent 245 × 342 px : utiles pour afficher
  les cartes, pas une garantie de qualité suffisante pour entraîner le scanner.
- Liens publics, pas une API contractuelle : disponibilité et chemins peuvent
  changer. Une réponse 200 seule ne valide jamais une correspondance visuelle.
- L'accès public ne vaut pas licence de redistribution ni autorisation générale
  d'exploitation. Confirmer les conditions d'utilisation avant publication ;
  les images et marques restent la propriété de leurs ayants droit.
- L'index est un instantané livré avec l'application. Les nouveaux liens seront
  disponibles après régénération et mise à jour du code/bundle. Une distribution
  distante versionnée pourra être ajoutée à une étape ultérieure.

## Vérification sur téléphone

Recharger Expo Go et chercher en français Méganium, Lézargus, Alakazam ou
Dracaufeu. Ouvrir les promos MEP 001/002/003 ou Dracaufeu Détective Pikachu 5/18.
Vérifier le visuel et la mention « Image : Malie ».
Ouvrir aussi une carte déjà illustrée par TCGdex : elle doit garder sa source.
Ajouter une des cartes à la collection et vérifier le même visuel après reload.
La consultation hors ligne des images n'est pas garantie.

Pour le japonais, sélectionner JP et chercher `リザードン`. Ouvrir **SM6a
003/053** : le visuel doit être japonais et afficher « Image : TCGplayer JP ».
Tester aussi `フシギダネ`, SM8b 001/150, puis une carte de SV2a déjà illustrée
par TCGdex. Ajouter une carte japonaise à la collection et vérifier son visuel
après reload, sans réimporter les cartes déjà sauvegardées.

Après cet incrément japonais : **31 tests de logique réussis**, TypeScript et
ESLint sans erreur, exports Android et iOS réussis. Les six liens japonais
témoins ont été testés en ligne ; le rendu natif et le passage au secours après
erreur réseau restent à valider sur téléphone.

Vérifications de cet incrément : 23 tests de logique réussis, dont contrôle de
l'origine et de la langue des 29 543 liens. Les 16 cartes témoins du test en ligne
ont été recoupées avec leurs fiches actuelles et leurs liens ont répondu HTTP 200
image/png ; l'isolement japonais a été vérifié. Trois visuels ont été inspectés
dans le navigateur : Méganium MEP 001 FR, Dracaufeu DET1 5 FR et Venusaur EX XY1 1 EN.
TypeScript et lint réussis, bundles Android et iOS exportés. Le rendu et les
événements réseau natifs restent à valider sur téléphone ; les 29 543 liens
n'ont pas tous été ouverts individuellement.
