/**
 * @typedef {import("@earendil-works/pi-coding-agent").ExtensionAPI} ExtensionAPI
 */

/** @param {ExtensionAPI} pi */
export default function (pi) {
  pi.registerShortcut('shift+alt+enter', {
    description: 'Send "continue" when the agent is stopped',
    handler: ctx => {
      if (ctx.isIdle()) pi.sendUserMessage('continue')
    }
  })
}
