const trace_mock =  jest.fn((local_image, callback) => {
  // console.log('child-process-promise.spawn', command, options)
  callback(null,)
})
exports.trace = trace_mock
exports.trace_mock = trace_mock
