import { defineSecret as define_secret } from 'firebase-functions/params'

export const twilio_account_sid = define_secret('TWILIO_ACCOUNT_SID')
export const twilio_auth_token = define_secret('TWILIO_AUTH_TOKEN')

export const twilio_secret_bindings = [
  twilio_account_sid,
  twilio_auth_token
]

export const twilio_ready = () =>
  !!(
    twilio_account_sid.value()?.trim() &&
    twilio_auth_token.value()?.trim()
  )

export const twilio_credentials = () => ({
  sid: twilio_account_sid.value(),
  token: twilio_auth_token.value()
})
