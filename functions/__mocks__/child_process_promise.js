const spawn_mock =  jest.fn((command, options) => {
  console.log('child-process-promise.spawn', command, options)
  return Promise.resolve(path)
})
exports.spawn = spawn_mock
exports.spawn_mock = spawn_mock
