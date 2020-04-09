const get_mock = jest.fn(itemid => {
  return 'some stufffff!!!!!!!!!!!!!!!'
})
const set_mock = jest.fn((key, value) => {
  return true
})
module.exports.set = set_mock
module.exports.get = get_mock
