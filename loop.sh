#!/usr/bin/env bash

while true; do
  if pnpm start; then
    exit 0
  else
    # failure: sleep random 180–300 seconds then retry
    sleep $(( RANDOM % 121 + 180 ))
  fi
done
