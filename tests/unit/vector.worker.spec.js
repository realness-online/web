import convert_to_vector from '@/vector.worker'
global.onmessage = function(message) {
  console.log(message)
};

describe('@/modules/convert_to_vector', () => {
  it('#make_avatar', async() => {
    await convert_to_vector.make_avatar()
  })
  it('#make_poster', async() => {
    await convert_to_vector.make_poster()
  })
})
