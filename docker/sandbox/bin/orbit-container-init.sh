#!/bin/sh
set -eu

HOME_DIR="${HOME:-/home/demo}"
SKEL_DIR="/opt/orbit/home-skel"

if [ -z "$(ls -A "$HOME_DIR" 2>/dev/null)" ]; then
    cp -a "$SKEL_DIR"/. "$HOME_DIR"/
fi

mkdir -p "$HOME_DIR/.config" "$HOME_DIR/.config/fish"

if [ -f "$SKEL_DIR/.config/fish/config.fish" ] && [ ! -f "$HOME_DIR/.config/fish/config.fish" ]; then
    cp "$SKEL_DIR/.config/fish/config.fish" "$HOME_DIR/.config/fish/config.fish"
fi

exec sh -lc 'trap : TERM INT; sleep infinity & wait'
