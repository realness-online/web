/** Pi's application keys map to shared semantic roles. */
const colors = {
  accent: "accent", border: "working", borderAccent: "accent", borderMuted: "muted",
  success: "success", error: "error", warning: "warning", muted: "muted", dim: "muted", text: "text",
  thinkingText: "muted", selectedBg: "raised",
  userMessageBg: "raised", userMessageText: "accent",
  customMessageBg: "raised", customMessageText: "muted", customMessageLabel: "accent",
  toolPendingBg: "raised", toolSuccessBg: "success-tint", toolErrorBg: "error-tint",
  toolTitle: "text", toolOutput: "muted",
  mdHeading: "warning", mdLink: "accent", mdLinkUrl: "muted", mdCode: "error", mdCodeBlock: "text",
  mdCodeBlockBorder: "muted", mdQuote: "muted", mdQuoteBorder: "muted", mdHr: "muted", mdListBullet: "accent",
  toolDiffAdded: "success", toolDiffRemoved: "error", toolDiffContext: "muted",
  syntaxComment: "muted", syntaxKeyword: "working", syntaxFunction: "warning", syntaxVariable: "accent",
  syntaxString: "secondary", syntaxNumber: "error", syntaxType: "accent", syntaxOperator: "muted", syntaxPunctuation: "muted",
  thinkingOff: "muted", thinkingMinimal: "working", thinkingLow: "accent", thinkingMedium: "warning",
  thinkingHigh: "secondary", thinkingXhigh: "error", bashMode: "accent",
}

export const pi = ({ name, scheme, roles }) => ({
  $schema: "https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
  name: `${name}-${scheme}`,
  appearance: scheme,
  vars: roles,
  colors,
  export: { pageBg: roles.background, cardBg: roles.raised, infoBg: roles["warning-tint"] },
})
