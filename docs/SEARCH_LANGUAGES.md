# Rechercher des cartes étrangères avec un nom français

## Version web — 2 octobre 2026

Catalogue et lot scanner partagent le dictionnaire local existant : sélectionner
JP puis saisir « Dracaufeu » cherche `リザードン`, sans API de traduction payante.
La correspondance est affichée ; les noms et impressions natifs restent inchangés.
Nom complet ou préfixe unique ; pas encore de suggestions cliquables sur le web
pour les préfixes ambigus. Utiliser le nom complet dans ce cas.

Catalogue : pagination de 24 fiches au-delà de la limite du lot scanner (72),
recherche par nom, numéro ou extension. Seuls les noms de Pokémon sont traduits.
Attente de saisie 400 ms, requêtes obsolètes annulées, délai UI maximal 20 s.
La fiche conserve les aliases FR/EN/JP des espèces reconnues dans son nom :
recherche française locale dans la collection IndexedDB, sans nouvelle requête.
Formes et noms composés : chercher le nom de base ; pas de traduction des textes.
Le chargement de la page et les images ne sont pas garantis hors ligne.

## Implémentation — 1er octobre 2026

La langue sélectionnée dans le catalogue désigne **la langue des cartes**, pas
la langue à utiliser pour saisir le nom du Pokémon.

- Catalogue JP + `Dracaufeu` → recherche TCGdex `リザードン`.
- Catalogue EN + `Dracaufeu` → recherche TCGdex `Charizard`.
- Catalogue JP + `Évoli` ou `evoli` → recherche TCGdex `イーブイ`.
- Les noms anglais et japonais restent acceptés.

L'interface affiche la correspondance utilisée. Les résultats, fiches, images
et exemplaires sauvegardés conservent **leurs noms et identifiants d'origine**.
Une carte japonaise n'est jamais remplacée par une impression française.

## Dictionnaire et fonctionnement

`expo-app/src/data/pokemon-names.json` contient les noms FR/EN/JP des **1 025
espèces Pokémon**, avec leur numéro national, la source, la date, son SHA-256 et
la notice de licence. La source est le fichier
[PokéAPI pokemon_species_names.csv](https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_species_names.csv),
langues 5 (français), 9 (anglais), 1 (japonais en kana). Le fichier embarqué
mesure **48 146 octets (~48 Ko)**, notice de licence comprise.

1. L'utilisateur choisit la langue des cartes puis saisit un nom français.
2. Le dictionnaire local résout immédiatement le nom, sans service de traduction
   externe, compte ou clé d'API. Casse et accents latins sont normalisés, sans
   confondre les symboles ♀/♂ ni enlever les marques de kana japonais.
3. La requête habituelle est envoyée à TCGdex dans la langue choisie : une seule
   requête par page, sans aller d'abord chercher des cartes françaises.
4. La pagination reste de 24 cartes ; attente de saisie de 400 ms et délai réseau
   maximal de 12 secondes inchangés. Les erreurs et annulations restent gérées.
5. TCGdex renvoie les impressions de la langue choisie. Le nom traduit est une
   aide à la recherche, jamais une modification de la carte ni de sa collection.

Un nom complet reconnu est prioritaire : `Draco` ne devient pas `Dracolosse`.
Un préfixe d'au moins trois caractères peut être complété s'il ne correspond
qu'à une seule espèce. Un préfixe ambigu comme `Drac` propose jusqu'à six noms
français cliquables. Aucun candidat n'est choisi automatiquement ; continuer à
saisir ou toucher une proposition relance la recherche. Les noms inconnus
restent recherchés littéralement dans le catalogue sélectionné.

La recherche de la collection compile aussi les noms correspondants pour FR,
EN et JP et peut retrouver les cartes étrangères déjà sauvegardées **hors ligne**.
Pour un préfixe ambigu, elle conserve les différentes espèces possibles dans
le filtrage local. Les filtres de finition, numéros et extensions sont préservés.
Les données persistées ne sont pas migrées ni réécrites.

## Limites de cette première étape

- Traduction des **noms d'espèces Pokémon**, pas du texte complet des cartes.
- Les noms de dresseurs, extensions, attaques et descriptions ne sont pas traduits.
- Les recherches par numéro et extension restent littérales, dans la langue choisie.
- Saisir le nom de base, par exemple `Dracaufeu`, pour retrouver aussi les
  impressions ex/GX/V et cartes dont le nom contient ce Pokémon. Une expression
  composée telle que `Dracaufeu-ex` ou `Miaouss de Galar` n'est pas encore traduite
  automatiquement : utiliser `Dracaufeu` ou `Miaouss`, puis choisir l'impression.
- C'est une recherche de noms contenant le nom traduit, pas une classification
  exacte par espèce : les noms combinés sont inclus, et certains noms partagés
  peuvent apparaître (par exemple Mew / Mewtwo). Aucun score de reconnaissance.
- Le dictionnaire n'assure pas qu'une carte existe dans la langue sélectionnée
  ni qu'elle soit renseignée par TCGdex. La couverture du catalogue reste partielle.

## Actualisation et licence

Depuis `expo-app/` :

```powershell
npm run names:refresh
npm test
npm run test:search-live
npx tsc --noEmit
npm run lint
```

L'actualisation lit seulement un fichier public CSV ; elle refuse un dictionnaire
incomplet avant d'écrire. Aucun code PokéAPI n'est exécuté et PokéAPI n'est pas
contacté par l'application à chaque recherche. Les nouveaux noms sont livrés
avec une mise à jour du bundle, pas par un téléchargement automatique.

La notice BSD-3-Clause est conservée dans
[POKEAPI_LICENSE.txt](./third-party/POKEAPI_LICENSE.txt) et embarquée dans le JSON.
Pokémon et ses noms de personnages restent des marques de leurs ayants droit.

## Vérifications et test sur téléphone

40 tests de logique réussis, dont correspondance dans les trois langues de
chacune des 1 025 espèces, accents, genres, préfixes ambigus, absence de requête
supplémentaire, collection hors ligne et conservation des identités.
Cinq recherches ont été validées sur l'API réelle : Dracaufeu JP/EN, Évoli JP,
Bulbizarre EN et M. Mime JP. Pagination et recherche japonaise native validées.
TypeScript, ESLint et exports Android/iOS réussis. Le rendu natif et les gestes
restent à confirmer sur téléphone.

Dans Expo Go après reload :

1. Ouvrir le catalogue, sélectionner **Japonais**, saisir `Dracaufeu`.
2. Vérifier « Recherche : Dracaufeu → リザードン » et des résultats JP.
3. Garder la saisie et choisir **Anglais** : les résultats doivent devenir EN.
4. Essayer `evoli` en JP ; puis `Drac` et toucher une suggestion française.
5. Ajouter une carte étrangère à la collection, chercher son nom français dans
   la collection, y compris hors ligne. Son nom, sa langue et son image restent
   ceux de la carte sauvegardée.
