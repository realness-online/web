/** Wait for two animation frames so layout has settled. */
export const after_layout = () =>
  new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })
