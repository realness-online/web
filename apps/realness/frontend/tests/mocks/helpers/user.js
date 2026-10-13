import auth from '../firebase/auth'

const test_user = {
  phoneNumber: '+14155550142',
  name: 'Scott Fryxell',
  id: '/+14155550142',
  avatar: '/+14155550142/avatars/1578929551564',
  visited: '2020-03-03T17:37:22.943Z'
}

export const setup_current_user = (user = test_user) => {
  localStorage.me = `/${user.phoneNumber}`
  auth.set_current_user(user)
}

export const clear_current_user = () => {
  localStorage.clear()
  auth.reset()
}
