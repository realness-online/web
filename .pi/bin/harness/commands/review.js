/**
 * Human review of commands the source scan cannot classify on its own.
 * Keyed by catalog entry id: [Keep|Remove, reason].
 *
 * Keep it short and factual. The catalog fills the rest; a missing key is
 * "Unknown" on purpose, so unreviewed commands stay visible.
 */
export const reviewed = {
  'apps/realness/package.json#scripts.check:frontend:fix': [
    'Keep',
    'Writes the format and lint fixes that `npm run check` reports.'
  ],
  'apps/realness/package.json#scripts.reset:local': [
    'Keep',
    'Rebuilds the local Lima halo from nothing; iCloud data is untouched.'
  ],
  'package.json#scripts.test:sessions': [
    'Keep',
    'Runs the Pi suite once per session format; the fork still reads both.'
  ],
  'package.json#scripts.prune:artifacts': [
    'Keep',
    'Maintenance command; covered by .pi/bin/specs/harness/artifacts-prune.spec.js.'
  ],

  'apps/realness/package.json#scripts.deploy:sync': ['Keep', 'Deploys the record service; `ship` calls it.'],
  'apps/realness/package.json#scripts.deploy:proxy': ['Keep', 'Deploys the model proxy; `ship` calls it.'],
  'apps/realness/package.json#scripts.serve:halo': ['Keep', 'Runs the host service locally.'],
  'apps/realness/package.json#scripts.start:sync': ['Keep', 'Runs the record service locally.'],
  'apps/realness/package.json#scripts.start:proxy': ['Keep', 'Runs the model proxy locally.'],
  'apps/realness/package.json#scripts.check:google': ['Keep', 'Live check for Google sign-in.'],
  'apps/realness/package.json#scripts.check:publish': ['Keep', 'Live check for publishing.'],
  'apps/realness/package.json#scripts.check:page-layout': ['Keep', 'Checks layout rules for baked pages.'],
  'apps/realness/package.json#scripts.certs': [
    'Keep',
    'Generates local development TLS certificates for the frontend.'
  ],
  'apps/realness/package.json#scripts.test:coverage:summary': [
    'Keep',
    'Prints a coverage summary; pairs with test:risk.'
  ],
  'apps/realness/package.json#scripts.build:prerender': [
    'Keep',
    'Step of the frontend build pipeline in src/command/frontend-command.js.'
  ],
  'apps/realness/package.json#scripts.build:manifest': [
    'Keep',
    'Step of the frontend build pipeline in src/command/frontend-command.js.'
  ],
  'apps/realness/package.json#scripts.build:toc': [
    'Keep',
    'Step of the frontend build pipeline in src/command/frontend-command.js.'
  ],
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

  '.pi/bin/harness/pi-fork.js#enable <verified-install>': [
    'Keep',
    'Documented in work/pi/FORK.md; activates the fork.'
  ],
  '.pi/bin/harness/pi-fork.js#rollback': ['Keep', 'Documented in work/pi/FORK.md; restores the prior launcher.'],
  '.pi/bin/harness/session-format.js#convert': ['Keep', 'Four JSONL session files and two recovery backups remain.'],

  'apps/realness/server/halo/guest/realness-chrome.js#lease': [
    'Keep',
    'Agent-browser leases a Chrome VM through this route.'
  ],
  'apps/realness/server/halo/guest/realness-site.js#versions': [
    'Keep',
    'Described in server/halo/guest/realness-chat.md.'
  ],
  'apps/realness/server/halo/guest/realness-site.js#restore <version>': [
    'Keep',
    'Described in server/halo/guest/realness-chat.md.'
  ],
  'apps/realness/server/halo/guest/realness-site.js#remove': [
    'Keep',
    'Described in server/halo/guest/realness-chat.md.'
  ],

  'apps/realness/tools/cli/bin/realness.js#frontend build': [
    'Keep',
    'Desktop frontend build; runs the pipeline in src/command/frontend-command.js.'
  ],
  'apps/realness/tools/cli/bin/realness.js#frontend deploy --env <environment>': [
    'Keep',
    'Desktop frontend deploy; used by the root ship script.'
  ],
  'apps/realness/tools/cli/bin/realness.js#logout': ['Keep', 'Sign-in surface; pairs with login.'],
  'apps/realness/tools/cli/bin/realness.js#whoami': ['Keep', 'Sign-in surface; pairs with login.'],
  'apps/realness/tools/cli/bin/realness.js#ls <can-url>': ['Keep', 'File surface; pairs with cp and rm.'],
  'apps/realness/tools/cli/bin/realness.js#cat <can-url>': ['Keep', 'File surface; pairs with cp and rm.'],
  'apps/realness/tools/cli/bin/realness.js#cp <source> <destination>': ['Keep', 'File surface; pairs with ls and rm.'],
  'apps/realness/tools/cli/bin/realness.js#rm <can-url>': ['Keep', 'File surface; pairs with ls and cp.'],
  'apps/realness/tools/cli/bin/realness.js#store sync <folder> <can-url>': [
    'Keep',
    'Sync surface; older name for realness sync.'
  ],
  'apps/realness/tools/cli/bin/realness.js#example app <destination>': ['Keep', 'Creates the Vue app starter.'],
  'apps/realness/tools/cli/bin/realness.js#fold': ['Keep', 'Merges conflict session copies; part of sync recovery.'],

  'apps/realness/tools/control/bin/webspace.js#local setup': ['Keep', 'One-time Lima host setup.'],
  'apps/realness/tools/control/bin/webspace.js#local build': ['Keep', 'Builds the local host template.'],

  'apps/realness/tools/publish/bin/publish.js#items list': ['Keep', 'Publishing surface for vault item identities.'],
  'apps/realness/tools/publish/bin/publish.js#items mint <vault-file> --type <type>': [
    'Keep',
    'Publishing surface; mints an item identity.'
  ],
  'apps/realness/tools/publish/bin/publish.js#items settle': [
    'Keep',
    'Publishing surface; separates copied item identities.'
  ],
  'apps/realness/tools/publish/bin/publish.js#app add <name> --type <type>': [
    'Keep',
    'Publishing surface; creates an app recipe.'
  ],
  'apps/realness/tools/publish/bin/publish.js#app build <name>': ['Keep', 'Publishing surface; builds an app recipe.'],
  'apps/realness/tools/publish/bin/publish.js#app list': ['Keep', 'Publishing surface; lists app recipes.'],
  'apps/realness/tools/publish/bin/publish.js#app publish <name>': [
    'Keep',
    'Publishing surface; publishes an app recipe.'
  ],
  'apps/realness/tools/publish/bin/publish.js#app unpublish <name>': [
    'Keep',
    'Publishing surface; removes a published app.'
  ],

  'apps/realness/.auto/checks.sh': ['Keep', 'Referenced by .auto/prompt.md; gate of the local .auto loop.'],
  'apps/realness/scripts/build-ghostty-wasm.sh': [
    'Keep',
    'Rebuilds the pinned terminal wasm by hand when a pin moves.'
  ],
  'apps/realness/tools/control/scripts/chrome-pool-check.js': ['Keep', 'Chrome VM pool gate; exercises ChromePool.'],
  'apps/realness/tools/control/scripts/chrome-render-pages.js': [
    'Keep',
    'Chrome VM render gate; records per-page CPU.'
  ],

  'package.json#scripts.prepare': ['Keep', 'npm runs it on install; points git at .pi/bin/hooks.'],
  'package.json#scripts.postinstall': ['Keep', 'npm runs it on install; installs .pi and the Pi runtime.'],
  'apps/realness/package.json#scripts.test:functions:watch': ['Keep', 'Reruns the functions specs while you edit.'],
  'apps/realness/package.json#scripts.deploy:storage': ['Keep', 'Deploys the Storage rules; ship does not.'],
  'apps/realness/package.json#scripts.gz3': ['Remove', 'One-time copy of records to the new layout.'],
  'apps/realness/package.json#scripts.check:crawl': ['Keep', 'Built-site crawl check; not yet in npm run check.'],
  'apps/realness/package.json#scripts.check:color-flip': [
    'Keep',
    'Light and dark color check; not yet in npm run live.'
  ],
  'apps/realness/package.json#scripts.check:pwa-build': ['Keep', 'Built-app PWA check; not yet in npm run check.'],
  'apps/realness/package.json#scripts.build:ghostty': ['Keep', 'Rebuilds the pinned terminal wasm when a pin moves.'],
  'apps/realness/package.json#scripts.eval:chat-parts': ['Keep', 'Scores the chat-parts skill; spends model tokens.'],
  'apps/realness/package.json#scripts.dev:gate': ['Keep', 'Runs the gate locally against development.'],
  '.pi/bin/harness/session-relocate.js#migrate': ['Remove', 'Migration ran.'],
  '.pi/bin/harness/session-relocate.js#rollback': ['Keep', 'Undo for the migration while the backups remain.'],
  '.pi/bin/harness/session-relocate.js#trial-migrate <harness>': ['Remove', 'Trial for a migration that ran.'],
  '.pi/bin/harness/session-relocate.js#trial-rollback <harness>': ['Remove', 'Trial for a migration that ran.'],
  '.pi/bin/harness/session-relocate.js#trial-copy <harness> <source> <target>': [
    'Remove',
    'Trial for a migration that ran.'
  ],
  '.pi/bin/harness/session-relocate.js#trial-restore <manifest>': ['Remove', 'Trial for a migration that ran.'],
  'apps/realness/server/halo/guest/realness-loop.js#"<goal>"': ['Keep', 'Starts a loop inside an actor.'],
  'apps/realness/tools/cli/bin/realness.js#watch': ['Keep', 'Live health, billing, and model spend.'],
  'apps/realness/tools/cli/bin/realness.js#production --help': ['Keep', 'Lists the operator commands.'],
  'apps/realness/checks/control/chrome-lease.check.js': ['Keep', 'Halo Chrome lease check; not yet in npm run live.'],
  'apps/realness/checks/control/h3-baseline.check.js': ['Remove', 'One-time h3 measurement.'],
  'apps/realness/checks/control/web-engine.check.js': ['Keep', 'Halo web engine check; not yet in npm run live.'],
  'apps/realness/checks/control/web-times.check.js': ['Keep', 'Halo web timing check; not yet in npm run live.'],
  'apps/realness/checks/halo/s9.check.js': ['Remove', 'One-time s9 check against production.'],
  'apps/realness/server/sync/bin/adopt-versions.js': ['Remove', 'One-time record migration.'],
  'apps/realness/server/sync/bin/remove-plain.js': ['Remove', 'One-time record cleanup.'],
  'apps/realness/tools/control/scripts/chrome-snapshot-check.js': ['Keep', 'Chrome VM snapshot gate.'],
  'apps/realness/tools/control/scripts/service-accounts.sh': [
    'Keep',
    'Creates the accounts and secrets the deploys need.'
  ],
  '.pi/skills/hyperframes/scripts/contrast-report.js': ['Keep', 'Hyperframes skill tool.']
}
