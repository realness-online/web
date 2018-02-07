import Person from '@/modules/Person'
import firebase from 'firebase'


jest.mock('firebase')

describe('Person.js', () => {
  it('Person exists', () => {
    expect(Person).toBeDefined()
  })

  it('Person.initializeApp exists', () => {
    let person = new Person()
    // expect(Person.initializeApp()).toBeDefined()
    // let person = new Person()
    // expect(person.auth).toBeDefined()
  })

})
