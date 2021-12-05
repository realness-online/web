const {
  VueRouterMock,
  createRouterMock,
  injectRouterMock
} = require('vue-router-mock')
const { config } = require('@vue/test-utils')

// create one router per test file
const router = createRouterMock()
beforeEach(() => {
  injectRouterMock(router)
})

// Add properties to the wrapper
config.plugins.VueWrapper.install(VueRouterMock)
