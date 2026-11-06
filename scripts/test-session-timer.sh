#!/bin/bash
# Self-contained: Bash 3.2+, standard utilities, no test framework.
set -eu
export LC_ALL=C
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
timer="$script_dir/session-timer.sh"
tmp=$(mktemp -d "${TMPDIR:-/tmp}/session-timer-test.XXXXXX")
trap 'rm -rf -- "$tmp"' EXIT
trap 'exit 1' HUP INT TERM
checks=0

fail() {
    printf 'FAIL: %s\n' "$*" >&2
    exit 1
}

expect_next() {
    expected=$1
    shift
    "$BASH" "$timer" "$@" >"$tmp/out" 2>"$tmp/err" || fail "unexpected failure: $*"
    printf '%s\n' "$expected" >"$tmp/expected"
    cmp -s "$tmp/expected" "$tmp/out" || fail "unexpected output: $*"
    [ ! -s "$tmp/err" ] || fail "unexpected stderr: $*"
    checks=$((checks + 1))
}

expect_error() {
    if "$BASH" "$timer" "$@" >"$tmp/out" 2>"$tmp/err"; then
        fail "expected rejection: $*"
    fi
    [ ! -s "$tmp/out" ] || fail "error wrote to stdout: $*"
    [ -s "$tmp/err" ] || fail "missing stderr: $*"
    checks=$((checks + 1))
}

# First exercise the real system clock; tolerate a second boundary.
before=$(date +%s)
actual=$("$BASH" "$timer" 1 2>"$tmp/err")
after=$(date +%s)
[[ $actual =~ ^[0-9]+$ ]] || fail 'default now is not an integer'
[ "$actual" -ge "$((before + 3600))" ] &&
    [ "$actual" -le "$((after + 3600))" ] || fail 'default now outside clock bounds'
[ ! -s "$tmp/err" ] || fail 'default now wrote stderr'
checks=$((checks + 1))

# A controlled date utility makes the default-time cases deterministic.
mkdir "$tmp/bin"
cat >"$tmp/bin/date" <<'EOF'
#!/bin/sh
[ "$#" -eq 1 ] && [ "$1" = '+%s' ] || exit 2
[ "${TEST_DATE_FAIL:-0}" = 0 ] || exit 1
printf '%s\n' "$TEST_DATE_VALUE"
EOF
chmod +x "$tmp/bin/date"
export PATH="$tmp/bin:$PATH"
export TEST_DATE_VALUE=1700000000 TEST_DATE_FAIL=0
expect_next 1700003600 1
expect_next 1700005400 1.5
expect_next 1700007200 2
expect_next 1700010800 3
expect_next 1700014400 4

# Explicit timestamps must not consult the current clock, even if it fails.
export TEST_DATE_FAIL=1
expect_next 1700003600 1 1700000000
expect_next 1700005400 1.5 1700000000
expect_next 1700007200 2 1700000000
expect_next 1700010800 3 1700000000
expect_next 1700014400 4 1700000000
expect_next 3600 1 0
# 2025-12-31 23:30 UTC -> 2026-01-01 01:00 UTC (day/month/year rollover).
expect_next 1767229200 1.5 1767223800
# 2024-02-28 23:30 UTC -> leap day 01:30 UTC.
expect_next 1709170200 2 1709163000
expect_next 9223372036854775807 1 9223372036854772207
expect_next 9223372036854775807 4 9223372036854761407

expect_error
expect_error 1 0 extra
for interval in '' 0 0.5 1.0 1.50 01 2.5 5 -1 +1 ' 1' '1 ' abc --unknown; do
    expect_error "$interval" 0
done
for epoch in '' -1 +1 01 08 1.5 ' 1' '1 ' '1+2' '1e3' '0x10' abc \
    '$(date)' 'a[0]' $'1\n2' 9223372036854772208 9223372036854775807 \
    9223372036854775808 999999999999999999999999999999; do
    expect_error 1 "$epoch"
done
expect_error 4 9223372036854761408
expect_error 1 # Failed date command.
export TEST_DATE_FAIL=0 TEST_DATE_VALUE=invalid
expect_error 1 # Invalid output from date.

for flag in -h --help; do
    "$BASH" "$timer" "$flag" >"$tmp/out" 2>"$tmp/err" || fail "help failed: $flag"
    [ ! -s "$tmp/err" ] || fail "help wrote stderr: $flag"
    for phrase in 'Usage:' '1, 1.5, 2, 3, or 4' 'date +%s' \
        'last change + current interval' 'date -r' 'date -d' 'BSD/macOS' 'GNU/Linux'; do
        grep -F -q -- "$phrase" "$tmp/out" || fail "help missing: $phrase"
    done
    checks=$((checks + 1))
    expect_error "$flag" 0
done

printf 'PASS: %s checks\n' "$checks"
