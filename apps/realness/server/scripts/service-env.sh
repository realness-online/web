#!/usr/bin/env bash
_settings_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
_service_settings="$(node "$_settings_root/src/settings/cli.js" shell deploy --env "${1:-}")" || return $?
eval "$_service_settings"
unset _settings_root _service_settings
