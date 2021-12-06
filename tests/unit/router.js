const {
  VueRouterMock,
  createRouterMock,
  injectRouterMock
} = require('vue-router-mock')
const { config } = require('@vue/test-utils')
// Add properties to the wrapper
config.plugins.VueWrapper.install(VueRouterMock)

// create one router per test file
const router = createRouterMock()
beforeEach(() => injectRouterMock(router))
