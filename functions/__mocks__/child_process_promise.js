const spawn_mock = jest.fn((command, options) => {
  return Promise.resolve()
})
exports.spawn = spawn_mock
exports.spawn_mock = spawn_mock
