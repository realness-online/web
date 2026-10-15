# Static starter

The product renderer lives in `tools/publish/renderer`.

Export a self-contained starter with:

```sh
realness example static <destination>
```

The exported folder includes its source, assets, tests, and package manifest.
It runs on its own after `npm install`. Hosted starter builds use the same
renderer source; generated files are not maintained here.
