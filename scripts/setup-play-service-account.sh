#!/usr/bin/env bash
#
# Creates the Google Cloud service account that lets CI publish to Play.
#
# Run this yourself, signed in as you - it needs your Google credentials, which is exactly why
# it is a script you run rather than something automated here. It prints the key to a file; the
# key never goes anywhere near a chat window or this repository.
#
#   gcloud auth login
#   bash scripts/setup-play-service-account.sh [PROJECT_ID]
#
# Afterwards there is one step this cannot do, because Google exposes no API for it: inviting
# the service account in Play Console. The script prints the address and the permissions to grant.
set -euo pipefail

PROJECT_ID="${1:-podshelf-publishing}"
SA_NAME="podshelf-ci"
KEY_FILE="podshelf-play-service-account.json"

command -v gcloud >/dev/null || { echo "gcloud is not installed: https://cloud.google.com/sdk/docs/install"; exit 1; }

echo "Project:        $PROJECT_ID"
echo "Service account: $SA_NAME"
echo

if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating project $PROJECT_ID"
  gcloud projects create "$PROJECT_ID" --name="Podshelf Publishing"
else
  echo "Project $PROJECT_ID already exists, using it"
fi

gcloud config set project "$PROJECT_ID" >/dev/null

echo "Enabling the Google Play Android Developer API"
gcloud services enable androidpublisher.googleapis.com --project="$PROJECT_ID"

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating service account $SA_EMAIL"
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="Podshelf CI (Play publishing)" \
    --project="$PROJECT_ID"
else
  echo "Service account already exists"
fi

# No project-level IAM role is granted on purpose. Publishing rights come from Play Console, not
# from Google Cloud - a role here would widen what the key can reach without helping.
if [ -f "$KEY_FILE" ]; then
  echo
  echo "$KEY_FILE already exists; not creating another key. Delete it first if you want a fresh one."
else
  echo "Creating a key at $KEY_FILE"
  gcloud iam service-accounts keys create "$KEY_FILE" \
    --iam-account="$SA_EMAIL" \
    --project="$PROJECT_ID"
fi

cat <<EOF

────────────────────────────────────────────────────────────────────────
Two things left, both by hand - there is no API for either.

1. Invite the service account in Play Console
     Play Console -> Users and permissions -> Invite new user
     Email:  $SA_EMAIL
     App permissions for Podshelf:
       - Manage store presence  <- REQUIRED to sync the store listing. Without it
                                   everything appears to work and only the final
                                   commit is refused with a bare 403.
       - Release to testing tracks
       - View app information and download bulk reports
       - Release to production  (only if you want tagged builds to go live)

     Permission changes can take minutes, occasionally up to 24 hours, to reach
     the API. If a 403 persists right after granting one, wait and retry before
     changing anything else.

2. Add the key as a GitHub secret
     Repo -> Settings -> Secrets and variables -> Actions
     Name:  PLAY_SERVICE_ACCOUNT_JSON
     Value: the entire contents of $KEY_FILE

     gh secret set PLAY_SERVICE_ACCOUNT_JSON < $KEY_FILE
       ...if you have the gh CLI.

Then delete the local copy - GitHub has it, and a key file lying in a
working tree is a key that eventually gets committed:

     rm $KEY_FILE
────────────────────────────────────────────────────────────────────────
EOF
