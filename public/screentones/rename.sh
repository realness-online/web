for file in *.svg; do
    mv -- "$file" "${file%}.html"
done
