'use strict'
const svgo = jest.genMockFromModule('svgo')
const svgo_mock = jest.fn(file => {
  // console.log('svgo_mock')
  const result = {
    data: file
  }
  return Promise.resolve(result)
})

class SVGO {
  static svgo_mock = svgo_mock
  constructor() {
   // console.log('initialize svgo')
  }

  optimize = svgo_mock
}

module.exports = SVGO
