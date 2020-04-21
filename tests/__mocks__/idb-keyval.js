const get_mock = jest.fn(itemid => {
  return 'some stufffff!!!!!!!!!!!!!!!'
})
const set_mock = jest.fn((key, value) => {
  return true
})
const delete_mock = jest.fn((key) => {
  return key
})

module.exports.set = set_mock
module.exports.del = delete_mock
module.exports.get = get_mock
