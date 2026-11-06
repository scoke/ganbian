#!/bin/bash
# Compatible with macOS Bash 3.2 and Linux Bash.
export LC_ALL=C

usage() {
    cat <<'EOF'
Usage: session-timer.sh INTERVAL [LAST_CHANGE_EPOCH]
       session-timer.sh -h|--help

INTERVAL must be exactly 1, 1.5, 2, 3, or 4 (hours).
LAST_CHANGE_EPOCH defaults to the current time (date +%s).
It must be nonnegative decimal Unix epoch seconds, with no sign or
leading zeros except 0 itself. The result must fit a signed 64-bit integer.
Prints only the next Unix epoch seconds: last change + current interval.
Changing the interval does not reset the last-change time; overdue results
are returned unchanged. Errors go to stderr with a nonzero exit status.

Example:
  next=$(./scripts/session-timer.sh 1.5 1767223800)
  date -r "$next" '+%Y-%m-%d %H:%M:%S %Z'    # BSD/macOS
  date -d "@$next" '+%Y-%m-%d %H:%M:%S %Z'   # GNU/Linux
Readable dates use your local timezone; add -u to date for UTC.
EOF
}

fail() {
    printf 'session-timer: %s\n' "$1" >&2
    exit 1
}

if [ "$#" -eq 1 ]; then
    case "$1" in
        -h|--help) usage; exit 0 ;;
    esac
fi
[ "$#" -ge 1 ] && [ "$#" -le 2 ] ||
    fail 'expected INTERVAL [LAST_CHANGE_EPOCH]; use --help for usage'

case "$1" in
    1) seconds=3600 ;;
    1.5) seconds=5400 ;;
    2) seconds=7200 ;;
    3) seconds=10800 ;;
    4) seconds=14400 ;;
    *) fail 'interval must be exactly 1, 1.5, 2, 3, or 4 hours' ;;
esac

if [ "$#" -eq 2 ]; then
    last_change=$2
else
    last_change=$(date +%s) || fail 'could not read current time'
fi

[[ $last_change =~ ^(0|[1-9][0-9]*)$ ]] ||
    fail 'last-change time must be nonnegative decimal seconds without signs or leading zeros'

# Compare decimal strings before arithmetic to prevent overflow or evaluation
# of untrusted arithmetic expressions. All accepted numbers are base ten.
max_last=$((9223372036854775807 - seconds))
if [ "${#last_change}" -gt "${#max_last}" ] ||
    { [ "${#last_change}" -eq "${#max_last}" ] && [[ $last_change > $max_last ]]; }; then
    fail 'next time would exceed the signed 64-bit integer limit'
fi

printf '%s\n' "$((last_change + seconds))"
