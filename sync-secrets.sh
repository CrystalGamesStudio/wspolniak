#!/bin/bash

# Syncs secrets from .${env}.vars to Cloudflare Workers
# Usage: ./sync-secrets.sh <env>
# Example: ./sync-secrets.sh production

set -euo pipefail

ENV=${1:-}

if [ -z "$ENV" ]; then
  echo "Usage: ./sync-secrets.sh <env>"
  echo "Example: ./sync-secrets.sh production"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VARS_FILE="$SCRIPT_DIR/.${ENV}.vars"

if [ ! -f "$VARS_FILE" ]; then
  echo "Error: $VARS_FILE not found"
  exit 1
fi

echo "Syncing secrets from $VARS_FILE to Cloudflare Workers environment: $ENV"
echo ""

COUNT=0

while IFS='=' read -r key value || [ -n "$key" ]; do
  # Skip empty lines and comments
  [[ -z "$key" || "$key" =~ ^#.*$ ]] && continue

  # Trim whitespace
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)

  # Strip surrounding quotes
  value="${value#\"}"
  value="${value%\"}"

  if [ -z "$value" ] || [ "$value" = "FILL_ME" ] || [ "$value" = "CHANGE_ME_USE_openssl_rand_base64_32" ]; then
    echo "  SKIP $key (empty or placeholder)"
    continue
  fi

  echo "  SET  $key"
  echo "$value" | wrangler secret put "$key" --env "$ENV"
  COUNT=$((COUNT + 1))
done < "$VARS_FILE"

echo ""
echo "Done — $COUNT secrets synced to $ENV environment"
