module.exports.get = jest.fn(_ => Promise.resolve(undefined))
module.exports.set = jest.fn(_ => Promise.resolve())
module.exports.del = jest.fn(_ => Promise.resolve())
module.exports.clear = jest.fn(_ => Promise.resolve())
module.exports.keys = jest.fn(_ => Promise.resolve([]))
