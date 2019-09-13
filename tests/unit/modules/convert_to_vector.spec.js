import convert_to_vector from '@/modules/convert_to_vector'

describe('@/modules/convert_to_vector', () => {
  it('#make_avatar', async() => {
    await convert_to_vector.make_avatar()
  })
  it('#make_poster', async() => {
    await convert_to_vector.make_poster()
  })
})
