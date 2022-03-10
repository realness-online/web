import {
  VueRouterMock,
  createRouterMock,
  injectRouterMock
} from 'vue-router-mock'

import { config } from '@vue/test-utils'

// Add properties to the wrapper
config.plugins.VueWrapper.install(VueRouterMock)

// create one router per test file
const router = createRouterMock()
beforeEach(() => injectRouterMock(router))
