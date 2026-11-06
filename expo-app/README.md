# TRACKTCG Mobile

Application React Native/Expo pour Android et iOS.

**Décision du 2 octobre 2026 : le produit web mobile est désormais prioritaire.**
Ce projet et sa collection SQLite sont conservés comme base de fonctionnalités
et option native ultérieure ; aucune suppression ou migration automatique.
Le [scanner Safari](../web-app/README.md) sert de base web, mais le catalogue
complet et la collection Expo restent à intégrer dans cette interface.
Consulter [l'ordre de travail actuel](../ROADMAP.md#ordre-de-travail) plutôt que
prendre les prochaines étapes natives ci-dessous comme un prérequis de la V1.

## Fonctionnalités présentes

- Navigation mobile avec Expo Router.
- Tableau de bord de collection, sans valorisation fictive.
- Catalogue réel TCGdex FR/EN/JP selon la couverture de la source, recherche par nom/numéro/extension et pagination.
- Recherche des cartes EN/JP avec un nom Pokémon français, dictionnaire local de 1 025 espèces et suggestions ; recherche multilingue de collection disponible hors ligne. Voir [les règles et tests](../docs/SEARCH_LANGUAGES.md).
- Fiches réelles et images lorsqu’elles sont disponibles.
- Images TCGdex prioritaires, secours Malie pour 14 682 cartes FR et 14 861 EN, P-Collector/TCGplayer pour 5 012 cartes JP, puis exceptions officielles FR ; voir [les correspondances et tests](../docs/CARD_IMAGES.md).
- Collection consultable avec recherche et filtres.
- Aperçu des tendances et liste de suivi.
- Flux caméra continu sans sauvegarde de photo.
- Permission caméra et lampe torche.
- Cadre de scan et états de reconnaissance.
- Résultat de scan, choix de finition et d'état.
- Ajout depuis le catalogue avec finition, état et prix d’achat unitaire facultatif.
- Collection persistante via Expo SQLite, restaurée après redémarrage.
- Regroupement des exemplaires identiques, en séparant langues, états, finitions et prix d’achat différents.
- Adaptateur Firebase utilisant des variables d'environnement.
- Interface abstraite pour brancher le moteur open source de reconnaissance.

Le moteur de reconnaissance réel n'est pas encore branché. Le bouton de test présent sur l'écran Scanner utilise `DevelopmentRecognitionEngine` afin de tester le parcours sans prétendre reconnaître une vraie carte.

Les exemples de scan sont marqués « Démo » et exclus du total financier. Les prix des cartes réelles restent indisponibles jusqu’à intégration d’une source tarifaire traçable. L’onglet Marché reste une démonstration.

## Tester cet incrément sur téléphone

1. Recharger l’application dans Expo Go (menu développeur → Reload) après mise à jour du code.
2. Accueil → **Explorer le catalogue**. Choisir JP ou EN puis saisir `Dracaufeu` en français ; les résultats restent dans la langue choisie. Les noms japonais/anglais restent acceptés. Le catalogue public nécessite Internet.
3. Ouvrir une fiche, vérifier le numéro et l’extension, choisir état/finition et saisir éventuellement `12,50` comme prix d’achat.
4. Ajouter la carte : attendre la confirmation de sauvegarde. Ouvrir **Collection**.
5. Recharger complètement l’application : la carte doit rester présente. Ajouter le même exemplaire incrémente sa quantité ; changer langue, état, finition ou coût crée un lot distinct.
6. Sans Internet, les cartes déjà ajoutées et leurs détails restent consultables ; les images sont distantes et leur disponibilité hors ligne n’est pas garantie. Le catalogue affiche une erreur avec possibilité de réessayer.

La collection démarre vide, contrairement aux exemples préremplis du premier prototype. Le stockage est local à l’application/installation Expo Go, sans synchronisation Firebase : désinstaller l’application ou effacer ses données peut supprimer cette collection.

## Lancer localement

Prérequis : Node.js 22.13 ou supérieur et l'application Expo Go sur un téléphone Android ou iOS.

```powershell
npm install
npm start
```

Scannez ensuite le QR code avec Expo Go. La caméra doit être testée sur un véritable téléphone.

`npm start` cible explicitement Expo Go. La préparation `expo-dev-client` permet
une future app native dédiée, mais ne reconnaît pas encore les cartes. Pour
tester le futur flux natif sur iPhone, voir [la préparation iOS](../docs/BUILD_IOS.md).
Après installation d'une development build, utiliser `npm run start:dev`.
La compilation locale iOS nécessite un Mac/Xcode ; aucun build cloud n'a été lancé.
Garder Expo Go : sa collection ne se transfère pas automatiquement vers l'app dédiée.

## Firebase

Copier `.env.example` vers `.env.local`, puis renseigner la configuration publique de l'application Firebase. L’adaptateur est préparé mais la connexion utilisateur TRACKTCG et la synchronisation ne sont pas encore implémentées. La collection utilise SQLite même si des variables Firebase sont renseignées. La connexion au compte Expo ne connecte pas à un compte TRACKTCG.

## Contrôles

```powershell
npx tsc --noEmit
npx expo lint
npm test
npm run test:catalog-live
npm run test:images-live
npm run test:images-jp-live
npm run test:search-live
npx expo-doctor
npx expo export --platform android --output-dir .expo\bundle-check
```

Les index de liens de secours peuvent être reconstruits avec `npm run images:refresh`
(FR/EN) et `npm run images:refresh-jp` (JP). Ils contiennent uniquement des
métadonnées et des liens (environ 2,77 Mo + 327 Ko), sans images. Les sources
restent incomplètes. Le japonais essaie TCGdex puis TCGplayer JP ; pour tester,
chercher `リザードン` en JP et ouvrir SM6a 003/053 après reload d'Expo Go.

Le dictionnaire multilingue peut être reconstruit avec `npm run names:refresh`.
Il est embarqué (~48 Ko avec licence), sans API de traduction à l'utilisation.
La traduction concerne les noms d'espèces ; saisir `Dracaufeu` plutôt que
`Dracaufeu-ex`. Numéros, extensions et noms de dresseurs restent littéraux.

## Prochaine étape technique

Construire le module de reconnaissance mobile open source :

Consulter [le plan de reconnaissance](../docs/RECOGNITION.md). Expo Go permet de tester cet incrément catalogue/collection ; l’analyse native des frames nécessitera une development build. TCG-AR est une référence de recherche pour GPU dont l’export mobile et les poids restent à auditer.

1. Détection et rectification de la carte.
2. Empreinte ArcFace optimisée mobile.
3. Index local des cartes Pokémon.
4. OCR spécialisé du numéro et de la langue.
5. Fusion des preuves et seuil de refus.
