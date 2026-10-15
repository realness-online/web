import { defineSecret as define_secret } from 'firebase-functions/params'
import { secret_set } from '#utils/secrets.js'

const twilio_account_sid = define_secret('TWILIO_ACCOUNT_SID')
const twilio_auth_token = define_secret('TWILIO_AUTH_TOKEN')

export const twilio_secret_bindings = [
  twilio_account_sid,
  twilio_auth_token
]

export const twilio_ready = () =>
  secret_set(twilio_account_sid) && secret_set(twilio_auth_token)

export const twilio_credentials = () => ({
  sid: twilio_account_sid.value(),
  token: twilio_auth_token.value()
})
