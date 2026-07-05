import { LoginForm } from '@/components/LoginForm'

type LoginPageSearchParams = Record<string, string | string[] | undefined>

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginPageSearchParams>
}) {
  const sp = await searchParams
  const error = Array.isArray(sp.error) ? sp.error[0] : sp.error
  return <LoginForm initialError={error ? error.slice(0, 160) : undefined} />
}
