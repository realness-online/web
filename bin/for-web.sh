#!/usr/bin/env bash

set -euo pipefail

MAX_IMAGE=1600
IMAGE_QUALITY=82
MAX_HEIGHT=1080
CRF=28

human() {
  if [ "$1" -ge 1048576 ]; then
    printf '%sM' $(($1 / 1048576))
  else
    printf '%sK' $(($1 / 1024))
  fi
}

need() {
  command -v "$1" >/dev/null || {
    echo "needs $1: brew install $2" >&2
    exit 1
  }
}

do_image() {
  local f=$1 base=${1%.*} before
  before=$(stat -f%z "$f")

  magick "$f" \
    -auto-orient \
    -colorspace sRGB \
    -resize "${MAX_IMAGE}x${MAX_IMAGE}>" \
    -strip \
    -interlace JPEG \
    -sampling-factor 4:2:0 \
    -quality $IMAGE_QUALITY \
    "${base}-web.jpg"

  magick "${base}-web.jpg" -quality $IMAGE_QUALITY "${base}-web.webp"

  printf '%s  %s -> jpg %s, webp %s\n' "$f" "$(human "$before")" \
    "$(human "$(stat -f%z "${base}-web.jpg")")" \
    "$(human "$(stat -f%z "${base}-web.webp")")"
}

do_video() {
  local f=$1 out=${1%.*}-web.mp4 before
  before=$(stat -f%z "$f")

  ffmpeg -nostdin -loglevel error -y -i "$f" \
    -vf "scale=-2:'min($MAX_HEIGHT,ih)'" \
    -c:v libx264 -crf $CRF -preset slow -pix_fmt yuv420p \
    -c:a aac -b:a 128k \
    -movflags +faststart \
    "$out"

  printf '%s  %s -> %s\n' "$f" "$(human "$before")" "$(human "$(stat -f%z "$out")")"
}

if [ $# -gt 0 ]; then
  files=("$@")
else
  shopt -s nullglob nocaseglob
  files=(*.jpg *.jpeg *.png *.tif *.tiff *.heic *.mov *.mp4 *.m4v *.avi *.mkv)
  shopt -u nullglob nocaseglob
fi

images=()
videos=()

shopt -s nocasematch

for f in ${files[@]+"${files[@]}"}; do
  case "$f" in *-web.jpg | *-web.webp | *-web.mp4) continue ;; esac
  case "$f" in
    *.jpg | *.jpeg | *.png | *.tif | *.tiff | *.heic) images+=("$f") ;;
    *.mov | *.mp4 | *.m4v | *.avi | *.mkv) videos+=("$f") ;;
    *) echo "skipping $f (not an image or video)" >&2 ;;
  esac
done

if [ ${#images[@]} -eq 0 ] && [ ${#videos[@]} -eq 0 ]; then
  echo "nothing to optimize here"
  exit 0
fi

[ ${#images[@]} -gt 0 ] && need magick imagemagick
[ ${#videos[@]} -gt 0 ] && need ffmpeg ffmpeg

for f in ${images[@]+"${images[@]}"}; do do_image "$f"; done
for f in ${videos[@]+"${videos[@]}"}; do do_video "$f"; done
