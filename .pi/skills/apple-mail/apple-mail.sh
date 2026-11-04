#!/usr/bin/env bash
set -euo pipefail

MAIL_DIR="$HOME/Library/Mail"
MAIL_VERSION_DIR=""
ENVELOPE_DB=""

find_mail_dir() {
    MAIL_VERSION_DIR=$(find "$MAIL_DIR" -maxdepth 1 -type d -name 'V*' | sort -V | tail -1)
    if [[ -z "$MAIL_VERSION_DIR" ]]; then
        echo "Error: No Apple Mail data directory found in $MAIL_DIR" >&2
        exit 1
    fi
    ENVELOPE_DB="$MAIL_VERSION_DIR/MailData/Envelope Index"
    if [[ ! -f "$ENVELOPE_DB" ]]; then
        echo "Error: Envelope Index not found at $ENVELOPE_DB" >&2
        exit 1
    fi
}

sql() {
    sqlite3 -header -separator '|' "$ENVELOPE_DB" "$1"
}

sql_noheader() {
    sqlite3 -separator '|' "$ENVELOPE_DB" "$1"
}

format_date() {
    if command -v gdate &>/dev/null; then
        gdate -d "@$1" '+%Y-%m-%d %H:%M' 2>/dev/null || echo "$1"
    else
        date -r "$1" '+%Y-%m-%d %H:%M' 2>/dev/null || echo "$1"
    fi
}

date_to_ts() {
    if command -v gdate &>/dev/null; then
        gdate -d "$1" '+%s' 2>/dev/null
    else
        date -j -f '%Y-%m-%d' "$1" '+%s' 2>/dev/null
    fi
}

msg_data_subpath() {
    local id="$1"
    local prefix="${id:0:${#id}-3}"
    if [[ -z "$prefix" ]]; then
        echo ""
        return
    fi
    local reversed=""
    for (( i=${#prefix}-1; i>=0; i-- )); do
        reversed+="${prefix:$i:1}/"
    done
    echo "${reversed%/}"
}

find_emlx() {
    local msg_id="$1"
    local subpath
    subpath=$(msg_data_subpath "$msg_id")

    local search_path
    if [[ -n "$subpath" ]]; then
        search_path="$subpath/Messages"
    else
        search_path="Messages"
    fi

    find "$MAIL_VERSION_DIR" -path "*/Data/$search_path/${msg_id}.emlx" -o -path "*/Data/$search_path/${msg_id}.partial.emlx" 2>/dev/null | head -1
}

find_attachment_dir() {
    local msg_id="$1"
    local subpath
    subpath=$(msg_data_subpath "$msg_id")

    local search_path
    if [[ -n "$subpath" ]]; then
        search_path="$subpath/Attachments/$msg_id"
    else
        search_path="Attachments/$msg_id"
    fi

    find "$MAIL_VERSION_DIR" -type d -path "*/Data/$search_path" 2>/dev/null | head -1
}

cmd_mailboxes() {
    sql "SELECT mb.ROWID, mb.url, mb.total_count, mb.unread_count
         FROM mailboxes mb
         ORDER BY mb.url"
}

cmd_search() {
    local from_filter="" to_filter="" subject_filter="" body_filter=""
    local mailbox_filter="" after_ts="" before_ts=""
    local unread="" flagged="" has_attachment=""
    local limit=20

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --from)     from_filter="$2"; shift 2 ;;
            --to)       to_filter="$2"; shift 2 ;;
            --subject)  subject_filter="$2"; shift 2 ;;
            --body)     body_filter="$2"; shift 2 ;;
            --mailbox)  mailbox_filter="$2"; shift 2 ;;
            --after)    after_ts=$(date_to_ts "$2"); shift 2 ;;
            --before)   before_ts=$(date_to_ts "$2"); shift 2 ;;
            --unread)   unread=1; shift ;;
            --flagged)  flagged=1; shift ;;
            --has-attachment) has_attachment=1; shift ;;
            --limit)    limit="$2"; shift 2 ;;
            *) echo "Unknown option: $1" >&2; exit 1 ;;
        esac
    done

    local where_clauses=()

    if [[ -n "$from_filter" ]]; then
        local esc_from="${from_filter//\'/\'\'}"
        where_clauses+=("a.address LIKE '%${esc_from}%'")
    fi

    if [[ -n "$to_filter" ]]; then
        local esc_to="${to_filter//\'/\'\'}"
        where_clauses+=("m.ROWID IN (SELECT r.message FROM recipients r JOIN addresses ra ON r.address = ra.ROWID WHERE ra.address LIKE '%${esc_to}%')")
    fi

    if [[ -n "$subject_filter" ]]; then
        local esc_subj="${subject_filter//\'/\'\'}"
        where_clauses+=("s.subject LIKE '%${esc_subj}%'")
    fi

    if [[ -n "$body_filter" ]]; then
        local esc_body="${body_filter//\'/\'\'}"
        where_clauses+=("su.summary LIKE '%${esc_body}%'")
    fi

    if [[ -n "$mailbox_filter" ]]; then
        local esc_mb="${mailbox_filter//\'/\'\'}"
        where_clauses+=("mb.url LIKE '%${esc_mb}%'")
    fi

    if [[ -n "$after_ts" ]]; then
        where_clauses+=("m.date_received >= $after_ts")
    fi

    if [[ -n "$before_ts" ]]; then
        where_clauses+=("m.date_received <= $before_ts")
    fi

    if [[ -n "$unread" ]]; then
        where_clauses+=("m.read = 0")
    fi

    if [[ -n "$flagged" ]]; then
        where_clauses+=("m.flagged = 1")
    fi

    if [[ -n "$has_attachment" ]]; then
        where_clauses+=("m.ROWID IN (SELECT DISTINCT att.message FROM attachments att)")
    fi

    where_clauses+=("m.deleted = 0")

    local where_sql=""
    if [[ ${#where_clauses[@]} -gt 0 ]]; then
        local joined=""
        for clause in "${where_clauses[@]}"; do
            if [[ -n "$joined" ]]; then
                joined="$joined AND $clause"
            else
                joined="$clause"
            fi
        done
        where_sql="WHERE $joined"
    fi

    local query="
        SELECT m.ROWID AS id,
               a.address AS sender,
               a.comment AS sender_name,
               s.subject,
               datetime(m.date_received, 'unixepoch', 'localtime') AS received,
               CASE WHEN m.read = 1 THEN '' ELSE 'UNREAD' END AS status,
               CASE WHEN m.flagged = 1 THEN 'FLAGGED' ELSE '' END AS flagged,
               REPLACE(REPLACE(mb.url, 'imap://', ''), 'local://', '') AS mailbox,
               (SELECT COUNT(*) FROM attachments att WHERE att.message = m.ROWID) AS attachments
        FROM messages m
        JOIN addresses a ON m.sender = a.ROWID
        JOIN subjects s ON m.subject = s.ROWID
        JOIN mailboxes mb ON m.mailbox = mb.ROWID
        LEFT JOIN summaries su ON m.summary = su.ROWID
        $where_sql
        ORDER BY m.date_received DESC
        LIMIT $limit
    "

    sql "$query"
}

cmd_info() {
    local msg_id="$1"

    echo "=== Message $msg_id ==="
    echo ""

    sql "SELECT m.ROWID AS id,
                a.address AS sender,
                a.comment AS sender_name,
                s.subject,
                datetime(m.date_received, 'unixepoch', 'localtime') AS received,
                datetime(m.date_sent, 'unixepoch', 'localtime') AS sent,
                m.size,
                CASE WHEN m.read = 1 THEN 'read' ELSE 'unread' END AS status,
                CASE WHEN m.flagged = 1 THEN 'flagged' ELSE '' END AS flagged,
                mb.url AS mailbox
         FROM messages m
         JOIN addresses a ON m.sender = a.ROWID
         JOIN subjects s ON m.subject = s.ROWID
         JOIN mailboxes mb ON m.mailbox = mb.ROWID
         WHERE m.ROWID = $msg_id"

    echo ""
    echo "--- Recipients ---"
    sql "SELECT a.address, a.comment,
                CASE r.type WHEN 0 THEN 'to' WHEN 1 THEN 'cc' WHEN 2 THEN 'bcc' END AS type
         FROM recipients r
         JOIN addresses a ON r.address = a.ROWID
         WHERE r.message = $msg_id
         ORDER BY r.type, r.position"

    echo ""
    echo "--- Attachments ---"
    sql "SELECT att.attachment_id, att.name
         FROM attachments att
         WHERE att.message = $msg_id"

    echo ""
    echo "--- Summary/Preview ---"
    sql_noheader "SELECT su.summary FROM messages m JOIN summaries su ON m.summary = su.ROWID WHERE m.ROWID = $msg_id" | head -20
}

cmd_read() {
    local msg_id="$1"
    local emlx_path
    emlx_path=$(find_emlx "$msg_id")

    if [[ -z "$emlx_path" ]]; then
        echo "Error: Could not find .emlx file for message $msg_id" >&2
        echo "The email body may not have been downloaded (check if it exists as .partial.emlx)" >&2
        exit 1
    fi

    local basename
    basename=$(basename "$emlx_path")
    if [[ "$basename" == *.partial.emlx ]]; then
        echo "Note: This is a partial download (headers only, body not fully cached locally)" >&2
        echo "" >&2
    fi

    local byte_count
    byte_count=$(head -1 "$emlx_path" | tr -d '[:space:]')

    if [[ "$byte_count" =~ ^[0-9]+$ ]]; then
        tail -c +$((${#byte_count} + 2)) "$emlx_path" | head -c "$byte_count"
    else
        cat "$emlx_path"
    fi
}

cmd_attachment() {
    local msg_id="$1"
    local filter_name="${2:-}"

    local att_dir
    att_dir=$(find_attachment_dir "$msg_id")

    if [[ -z "$att_dir" ]]; then
        echo "Error: No attachment directory found for message $msg_id" >&2
        echo "" >&2
        echo "Available attachments in database:" >&2
        sql "SELECT att.attachment_id, att.name FROM attachments att WHERE att.message = $msg_id" >&2
        exit 1
    fi

    local tmpdir
    tmpdir="$(cd "$(dirname "$0")/../../.." && pwd)/artifacts/apple-mail/${msg_id}"
    mkdir -p "$tmpdir"

    local found=0
    while IFS= read -r -d '' file; do
        local name
        name=$(basename "$file")
        if [[ -n "$filter_name" && "$name" != "$filter_name" ]]; then
            continue
        fi
        cp "$file" "$tmpdir/$name"
        found=$((found + 1))
    done < <(find "$att_dir" -type f -print0 2>/dev/null)

    if [[ $found -eq 0 ]]; then
        rmdir "$tmpdir" 2>/dev/null || true
        echo "Error: No attachments found${filter_name:+ matching '$filter_name'}" >&2
        exit 1
    fi

    echo "$tmpdir"
    echo "" >&2
    echo "Extracted $found attachment(s) to: $tmpdir" >&2
    ls -la "$tmpdir" >&2
}

find_mail_dir

case "${1:-help}" in
    search)     shift; cmd_search "$@" ;;
    read)       shift; cmd_read "$1" ;;
    attachment) shift; cmd_attachment "$1" "${2:-}" ;;
    mailboxes)  cmd_mailboxes ;;
    info)       shift; cmd_info "$1" ;;
    help|--help|-h)
        echo "Usage: $0 search|read|attachment|info|mailboxes - see SKILL.md beside this script"
        ;;
    *)
        echo "Unknown command: $1" >&2
        echo "Run '$0 help' for usage" >&2
        exit 1
        ;;
esac
