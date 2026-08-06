# Guide poche — Brasserie des Archers

## 1. Mettre à jour le site (une fois importé sur Vercel)

Vercel est branché sur GitHub. Donc :

1. Modifie les fichiers (toi, ou moi via ce repo).
2. `git add -A && git commit -m "..." && git push`
3. Vercel redéploie automatiquement en 1-2 minutes. Rien d'autre à faire.

Pas de push → pas de mise à jour en ligne. C'est tout.

## 2. Variables d'environnement à mettre sur Vercel

Vercel → ton projet → **Settings → Environment Variables**. Ajoute :

| Variable | Valeur | Obligatoire ? |
|---|---|---|
| `ADMIN_PASSWORD` | Le mot de passe de ton choix pour entrer dans `/#admin` (en clair) | Oui — sinon impossible de se connecter à l'admin |
| `RESEND_API_KEY` | Ta clé API [resend.com](https://resend.com) (pour l'envoi des emails de réservation/newsletter) | Oui, sinon aucun email n'est envoyé (le site continue de fonctionner, juste sans email) |
| `CONTACT_EMAIL` | L'adresse où tu veux recevoir les demandes de réservation (ex: ton gmail) | Oui, sinon les emails de notification n'ont pas de destinataire |
| `SITE_URL` | `https://lesarchersvoiron.fr` (ou l'URL Vercel si le domaine n'est pas encore branché) | Recommandé |
| `CRON_SECRET` | Une chaîne aléatoire (ex: générée sur [1password.com/password-generator](https://1password.com/password-generator)) — sécurise la tâche automatique quotidienne | Recommandé |
| `CAMPAIGNS_ENABLED` | `true` | Seulement quand tu veux activer l'envoi réel des campagnes email (relances, avis). Tant que c'est absent/`false`, tout reste en mode simulation, rien n'est envoyé. |
| `REVIEW_URL` | Lien vers votre fiche Google pour laisser un avis | Optionnel, une valeur par défaut est déjà en place |

**Supabase (compte client "Mon espace")** : connecté ✅ — l'URL et la clé publique sont directement dans `script.js` (elles sont conçues pour être publiques, comme une clé anon). Inscription/connexion par email fonctionnent réellement. Un compte de test a été créé pendant la vérification (`archersvoiron.test+...@gmail.com`) — supprimable depuis Supabase → Authentication → Users si tu veux une liste propre.

Reste **volontairement non branché** : `SUPABASE_SERVICE_ROLE_KEY` et `STRIPE_SECRET_KEY`. Sans eux, "Mes réservations" et le paiement en ligne restent inactifs — seule l'inscription/connexion de base fonctionne. Le projet Supabase (`zuwvoroyfwieiiwuxspi`) n'est pas géré depuis le même compte que le connecteur MCP utilisé ici, donc la création de tables devra se faire manuellement sur le dashboard Supabase le jour où on active ces fonctionnalités.

## 3. Base de données (Vercel KV) — obligatoire pour l'admin

Le panneau admin (réservations, newsletter, campagnes) stocke ses données dans **Vercel KV**.

1. Sur ton projet Vercel → onglet **Storage** → **Create Database** → **KV**.
2. Connecte-la au projet (bouton "Connect Project").
3. Vercel ajoute automatiquement les variables `KV_REST_API_URL` / `KV_REST_API_TOKEN` — tu n'as rien à taper toi-même.

Sans ça, l'admin ne pourra pas sauvegarder les réservations/inscriptions.

## 4. Code d'entrée dans l'admin

Il n'y en a **pas par défaut** — c'est toi qui le choisis en réglant `ADMIN_PASSWORD` (étape 2 ci-dessus).
Une fois réglé, va sur `https://lesarchersvoiron.fr/#admin` et entre ce mot de passe.

## 5. Ordre recommandé pour la mise en ligne complète

1. Importer le repo sur Vercel (`Add New → Project → glm02/archersvoiron`).
2. Créer et connecter la base KV (étape 3).
3. Ajouter `ADMIN_PASSWORD`, `RESEND_API_KEY`, `CONTACT_EMAIL`, `SITE_URL` (étape 2).
4. Redéployer (Vercel le refait automatiquement après un ajout de variable, ou clique "Redeploy").
5. Se connecter sur `/#admin` avec le mot de passe choisi.
