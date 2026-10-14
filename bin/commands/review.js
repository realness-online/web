/**
 * Human review of commands the source scan cannot classify on its own.
 * Keyed by catalog entry id: [Keep|Remove, reason].
 *
 * Keep it short and factual. The catalog fills the rest; a missing key is
 * "Unknown" on purpose, so unreviewed commands stay visible.
 */
export const reviewed = {
  'package.json#scripts.test:sessions': ['Keep', 'Runs the Pi suite once per session format; the fork still reads both.'],
  'package.json#scripts.prune:artifacts': ['Keep', 'Maintenance command; covered by bin/artifacts-prune.test.js.'],

  'apps/realness/package.json#scripts.deploy:sync': ['Keep', 'Deploys the record service; documented by script path in .tooling.md.'],
  'apps/realness/package.json#scripts.deploy:proxy': ['Keep', 'Deploys the model proxy; documented by script path in .tooling.md.'],
  'apps/realness/package.json#scripts.serve:host': ['Keep', 'Runs the host service locally.'],
  'apps/realness/package.json#scripts.start:sync': ['Keep', 'Runs the record service locally.'],
  'apps/realness/package.json#scripts.start:proxy': ['Keep', 'Runs the model proxy locally.'],
  'apps/realness/package.json#scripts.check:google': ['Keep', 'Live check for Google sign-in.'],
  'apps/realness/package.json#scripts.check:publish': ['Keep', 'Live check for publishing.'],
  'apps/realness/package.json#scripts.check:page-layout': ['Keep', 'Checks layout rules for baked pages.'],
  'apps/realness/package.json#scripts.certs': ['Keep', 'Generates local development TLS certificates for the frontend.'],
  'apps/realness/package.json#scripts.test:coverage:summary': ['Keep', 'Prints a coverage summary; pairs with test:risk.'],
  'apps/realness/package.json#scripts.build:prerender': ['Keep', 'Step of the frontend build pipeline in src/command/frontend-command.js.'],
  'apps/realness/package.json#scripts.build:manifest': ['Keep', 'Step of the frontend build pipeline in src/command/frontend-command.js.'],
  'apps/realness/package.json#scripts.build:toc': ['Keep', 'Step of the frontend build pipeline in src/command/frontend-command.js.'],
  'apps/realness/package.json#scripts.serve:frontend': ['Keep', 'Previews a built frontend.'],
  'apps/realness/package.json#scripts.serve:frontend:https': ['Keep', 'Previews a built frontend over HTTPS.'],
  'apps/realness/package.json#scripts.test:update': ['Keep', 'Refreshes frontend test snapshots.'],
  'apps/realness/package.json#scripts.fallow': ['Keep', 'Fallow health report; see the test-coverage skill.'],
  'apps/realness/package.json#scripts.fallow:fix': ['Keep', 'Fallow auto-fix; see the test-coverage skill.'],
  'apps/realness/package.json#scripts.test:ui': ['Keep', 'Frontend test UI.'],
  'apps/realness/package.json#scripts.start:gate': ['Keep', 'Runs the identity gate locally.'],
  'apps/realness/package.json#scripts.deploy:gate': ['Keep', 'Deploys the identity gate.'],
  '.pi/examples/app/package.json#scripts.preview': ['Keep', 'Preview script of the Vue app starter.'],
  '.pi/examples/static/package.json#scripts.build': ['Keep', 'Starter manifest; resolves in the exported site.'],
  '.pi/examples/static/package.json#scripts.dev': ['Keep', 'Starter manifest; resolves in the exported site.'],

  'bin/pi-fork.js#enable <verified-install>': ['Keep', 'Documented in work/pi/FORK.md; activates the fork.'],
  'bin/pi-fork.js#rollback': ['Keep', 'Documented in work/pi/FORK.md; restores the prior launcher.'],
  'bin/session-format.js#convert': ['Keep', 'Four JSONL session files and two recovery backups remain.'],

  'apps/realness/server/host/guest/brayness-chrome#lease': ['Keep', 'Agent-browser leases a Chrome VM through this route.'],
  'apps/realness/server/host/guest/brayness-site#versions': ['Keep', 'Described in server/host/guest/brayness-chat.md.'],
  'apps/realness/server/host/guest/brayness-site#restore <version>': ['Keep', 'Described in server/host/guest/brayness-chat.md.'],
  'apps/realness/server/host/guest/brayness-site#remove': ['Keep', 'Described in server/host/guest/brayness-chat.md.'],

  'apps/realness/tools/cli/bin/brayness.js#frontend build': ['Keep', 'Desktop frontend build; runs the pipeline in src/command/frontend-command.js.'],
  'apps/realness/tools/cli/bin/brayness.js#frontend deploy --env <environment>': ['Keep', 'Desktop frontend deploy; used by the root ship script.'],
  'apps/realness/tools/cli/bin/brayness.js#logout': ['Keep', 'Sign-in surface; pairs with login.'],
  'apps/realness/tools/cli/bin/brayness.js#whoami': ['Keep', 'Sign-in surface; pairs with login.'],
  'apps/realness/tools/cli/bin/brayness.js#ls <can-url>': ['Keep', 'File surface; pairs with cp and rm.'],
  'apps/realness/tools/cli/bin/brayness.js#cat <can-url>': ['Keep', 'File surface; pairs with cp and rm.'],
  'apps/realness/tools/cli/bin/brayness.js#cp <source> <destination>': ['Keep', 'File surface; pairs with ls and rm.'],
  'apps/realness/tools/cli/bin/brayness.js#rm <can-url>': ['Keep', 'File surface; pairs with ls and cp.'],
  'apps/realness/tools/cli/bin/brayness.js#store sync <folder> <can-url>': ['Keep', 'Sync surface; older name for brayness sync.'],
  'apps/realness/tools/cli/bin/brayness.js#example app <destination>': ['Keep', 'Creates the Vue app starter.'],
  'apps/realness/tools/cli/bin/brayness.js#fold': ['Keep', 'Merges conflict session copies; part of sync recovery.'],

  'apps/realness/tools/control/bin/webspace.js#local setup': ['Keep', 'One-time Lima host setup; documented in .tooling.md.'],
  'apps/realness/tools/control/bin/webspace.js#local build': ['Keep', 'Builds the local host template; documented in .tooling.md.'],

  'apps/realness/tools/publish/bin/publish.js#items list': ['Keep', 'Publishing surface for vault item identities.'],
  'apps/realness/tools/publish/bin/publish.js#items mint <vault-file> --type <type>': ['Keep', 'Publishing surface; mints an item identity.'],
  'apps/realness/tools/publish/bin/publish.js#items settle': ['Keep', 'Publishing surface; separates copied item identities.'],
  'apps/realness/tools/publish/bin/publish.js#app add <name> --type <type>': ['Keep', 'Publishing surface; creates an app recipe.'],
  'apps/realness/tools/publish/bin/publish.js#app build <name>': ['Keep', 'Publishing surface; builds an app recipe.'],
  'apps/realness/tools/publish/bin/publish.js#app list': ['Keep', 'Publishing surface; lists app recipes.'],
  'apps/realness/tools/publish/bin/publish.js#app publish <name>': ['Keep', 'Publishing surface; publishes an app recipe.'],
  'apps/realness/tools/publish/bin/publish.js#app unpublish <name>': ['Keep', 'Publishing surface; removes a published app.'],

  'apps/realness/frontend/.auto/checks.sh': ['Keep', 'Referenced by frontend/.auto/prompt.md; gate of the local .auto loop.'],
  'apps/realness/frontend/scripts/build-ghostty-wasm.sh': ['Keep', 'Rebuilds the pinned terminal wasm by hand when a pin moves.'],
  'apps/realness/tools/control/scripts/chrome-pool-check.js': ['Keep', 'Chrome VM pool gate; exercises ChromePool.'],
  'apps/realness/tools/control/scripts/chrome-render-pages.js': ['Keep', 'Chrome VM render gate; records per-page CPU.'],
}