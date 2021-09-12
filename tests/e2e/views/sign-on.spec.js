// https://docs.cypress.io/api/introduction/api.html

describe('/sign-on', () => {
  it('Visits the app root url', () => {
    cy.visit('/sign-on')
    cy.get('form#profile-mobile').find('fieldset#phone')
    cy.get
  })
})
