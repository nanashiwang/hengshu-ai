import { RegisterForm } from '@/components/RegisterForm'
import { getPayloadClient } from '@/lib/payload'
import { getRegistrationEmailRequired } from '@/lib/siteSettings'

type RegisterPageSearchParams = Record<string, string | string[] | undefined>

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<RegisterPageSearchParams>
}) {
  const sp = await searchParams
  const error = Array.isArray(sp.error) ? sp.error[0] : sp.error
  const payload = await getPayloadClient()
  const emailRequired = await getRegistrationEmailRequired(payload)
  return <RegisterForm emailRequired={emailRequired} initialError={error ? error.slice(0, 160) : undefined} />
}
