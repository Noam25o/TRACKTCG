# Version de développement sur iPhone

**Document conservé pour une option ultérieure.** Depuis la décision utilisateur
du 2 octobre 2026, la V1 web mobile est prioritaire et la version native sera
décidée après validation du web. Aucun compte Apple payant ou Mac n'est requis
pour continuer le prototype Safari. Les prérequis ci-dessous concernent
uniquement une éventuelle application native, pas la poursuite du produit web.
Voir [la roadmap actualisée](../ROADMAP.md#ordre-de-travail).

## État — 2 octobre 2026

L'appareil de test est un **iPhone** ; le poste de développement actuel est
Windows. La préparation locale ajoute `expo-dev-client` compatible SDK 57,
un profil EAS `development` pour appareil réel et un profil distinct
`development-simulator`. Aucun projet EAS distant, certificat Apple,
enregistrement d'appareil, build cloud ou publication App Store n'a été créé.

**Cela ne rend pas encore la reconnaissance fonctionnelle.** L'écran Scanner
garde son aperçu Expo Camera et son résultat de démonstration. Le prochain
incrément doit ajouter et tester l'accès natif aux frames en mémoire, puis
les moteurs spécialisés. Ne pas remplacer ce flux par des photos silencieuses.

## Choisir la méthode de compilation

- **Mac avec Xcode** : compiler localement et installer sur l'iPhone connecté.
  Un compte Apple gratuit peut servir aux tests personnels avec Xcode, avec
  des restrictions de signature et de durée. La signature gratuite peut
  nécessiter la sélection d'une Personal Team dans Xcode.
- **Pas de Mac, compte Apple Developer payant** : une compilation EAS cloud
  peut produire l'application signée pour l'iPhone enregistré. Elle doit être
  autorisée séparément : le code sera envoyé à Expo, et le dispositif de
  signature/enregistrement d'appareil sera configuré avec l'utilisateur.
- **Ni Mac ni compte Apple Developer payant** : on continue le développement
  et les tests catalogue/collection dans Expo Go. On ne peut pas valider
  notre futur processeur de frames natif sur cet iPhone avec Expo Go seul.

Les comptes Expo et Apple sont différents. Ne pas partager mot de passe,
code de validation Apple, certificat ou clé privée dans le chat ou le dépôt.
Aucun abonnement ni achat n'est déclenché par cette préparation.

Sources : [compilation locale Expo](https://docs.expo.dev/guides/local-app-development/),
[distribution interne EAS](https://docs.expo.dev/build/internal-distribution/),
[comptes développeur Apple](https://developer.apple.com/help/account/basics/about-your-developer-account).

## Continuer dans Expo Go

Depuis `mobile/` :

```powershell
npm start
```

`npm start` garde explicitement `expo start --go`, car la présence de
`expo-dev-client` peut changer la cible par défaut de `npx expo start`.
Scanner le QR code avec l'iPhone comme auparavant. Si le serveur est déjà
ouvert, ne pas lancer un deuxième serveur sur le même port.

## Avec un Mac — après préparation de la chaîne caméra native

Copier le projet sur le Mac, installer les dépendances et connecter l'iPhone.
Depuis `mobile/` :

```sh
npm ci
npm run ios:device
```

Cette commande correspond à `expo run:ios --device`. Expo génère le projet
`ios/` si nécessaire ; ne pas créer ni maintenir ses fichiers à la main.
Suivre la signature Apple/Xcode, puis les instructions de l'iPhone concernant
la confiance et le mode développeur. Un export JavaScript/Hermes n'est pas
un binaire iOS signé et ne permet pas d'installer l'application à lui seul.

## Avec EAS — uniquement après accord pour le cloud

Le profil est prêt, mais ces commandes **n'ont pas été exécutées**. Elles
doivent être guidées après choix de cette méthode, vérification du compte
Apple payant et autorisation d'envoyer le projet à Expo :

```sh
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile development
```

L'utilisateur réalise l'authentification et les étapes de signature. Ne pas
sélectionner `development-simulator` pour cet iPhone : un build de simulateur
ne s'installe pas sur un téléphone réel. Ne pas lancer `submit` ou une
publication App Store pour ce test. Vérifier quotas/coûts Expo avant la build.

## Après installation d'une vraie development build

Sur le poste qui sert le code :

```powershell
npm run start:dev
```

Ouvrir l'application **TRACKTCG de développement**, pas Expo Go, et connecter
le serveur local (PC et iPhone sur le même réseau). Les modifications JS/TS
se chargent depuis Metro ; une nouvelle dépendance native exige une nouvelle
compilation. Le launcher est configuré pour laisser choisir le serveur.

## Collection existante — ne rien effacer

Expo Go et l'application TRACKTCG dédiée utilisent des espaces de stockage
distincts. La collection SQLite d'Expo Go ne sera **pas copiée automatiquement**
dans la development build. Garder Expo Go et ses données ; ne pas désinstaller
ni effacer cette application. Un export/import de collection doit être ajouté
et vérifié avant un transfert de données réelles. Ce changement ne touche
pas la collection actuellement enregistrée dans Expo Go.

## Critères du prochain test natif

- Caméra arrière et permission, sans microphone ni accès à la photothèque requis.
- Frames vidéo traitées en mémoire et libérées ; aucune photo ou vidéo enregistrée.
- Arrêt du traitement quand l'écran est quitté ou que l'app passe en arrière-plan.
- Compteurs/latence réels sur appareil, sans données de précision simulées.
- Catalogue et collection toujours accessibles ; pas d'ajout automatique non confirmé.
- Seulement ensuite : détecteur de carte, rectification, index visuel et OCR.

Les fichiers de préparation et les bundles peuvent être vérifiés sous Windows,
mais une compilation Xcode et les tests caméra sur l'iPhone restent à effectuer.

Vérifications de cet incrément : 42 tests de logique réussis, TypeScript et lint
sans erreur, Expo Doctor 21/21 et introspection de la configuration iOS réussie
(permission caméra et schémas du launcher). L'ajout de DevClient a révélé des
versions de dépendances optionnelles hors recommandations SDK 57 : React DOM
19.2.3, Worklets 0.10.1 et Reanimated 4.5.1 sont maintenant explicitement fixés
aux versions recommandées par le SDK. Aucun `--force` ni `--legacy-peer-deps`.

L'audit npm signale aussi **19 alertes (11 modérées, 8 élevées)** dans l'arbre
de dépendances Expo/Firebase, à examiner avant une publication. Il ne mesure
pas directement l'exploitabilité dans l'app iOS. Les corrections proposées
incluent des changements majeurs/rétrogradations de SDK ; aucun correctif forcé
ni changement de SDK Firebase/Expo n'a été appliqué. Les tests de compatibilité
ne valent donc pas validation de sécurité pour la production.
