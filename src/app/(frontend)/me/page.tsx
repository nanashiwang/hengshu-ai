import { redirect } from 'next/navigation'

// 个人中心已并入控制台 /console，保留旧路径重定向
export default function MeRedirect() {
  redirect('/console')
}
