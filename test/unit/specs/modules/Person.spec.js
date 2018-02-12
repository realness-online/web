// import {person, auth} from '@/modules/Person'
import firebase from 'firebase'

jest.mock('firebase', () => {
  return {
    auth:{
      currentUser:{}
    }
  }
})
it('should atually test stuff')
describe('Person.js', () => {})
