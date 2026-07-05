import { RegisterForm } from '@/components/RegisterForm'
import { getPayloadClient } from '@/lib/payload'
import { getRegistrationEmailRequired } from '@/lib/siteSettings'

export default async function RegisterPage() {
  const payload = await getPayloadClient()
  const emailRequired = await getRegistrationEmailRequired(payload)
  return <RegisterForm emailRequired={emailRequired} />
}
