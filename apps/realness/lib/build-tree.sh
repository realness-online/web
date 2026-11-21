tree_unmount() {
  for dir in dev/pts dev sys proc; do
    if mountpoint -q "$TREE/$dir"; then
      umount "$TREE/$dir" 2> /dev/null || umount -l "$TREE/$dir"
    fi
  done
  return 0
}

tree_remove() {
  tree_unmount
  if findmnt -rn -o TARGET | grep -q "^$TREE/"; then
    echo "a mount is still inside $TREE; it stays" >&2
    return 1
  fi
  rm -rf --one-file-system "$TREE"
}
