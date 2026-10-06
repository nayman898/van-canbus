#!/usr/bin/env sh
# Git asks for credentials through this helper, never through a token-bearing URL.
case "$1" in
  *Username*) printf '%s\n' 'x-access-token' ;;
  *Password*) printf '%s\n' "$WIKI_TOKEN" ;;
  *) exit 1 ;;
esac
