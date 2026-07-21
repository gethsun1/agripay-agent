#!/bin/sh
set -eu
curl --fail --silent --show-error http://127.0.0.1:3001/health >/dev/null
curl --fail --silent --show-error http://127.0.0.1:3001/ready >/dev/null
