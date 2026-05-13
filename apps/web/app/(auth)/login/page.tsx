import { Suspense } from 'react'
import type { Metadata } from 'next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Masuk',
  description: 'Masuk ke akun Atsar Anda.',
}

export default function LoginPage() {
  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl">Masuk ke Atsar</CardTitle>
        <CardDescription>
          Lanjutkan perjalanan belajar sirah Anda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<div className="h-10" />}>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  )
}
