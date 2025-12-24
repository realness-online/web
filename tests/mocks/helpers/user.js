import auth from '../firebase/auth'

export const test_user = {
  phoneNumber: '+16282281824',
  name: 'Scott Fryxell',
  id: '/+16282281824',
  avatar: '/+16282281824/avatars/1578929551564',
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
