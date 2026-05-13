import { Suspense } from 'react'
import type { Metadata } from 'next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export const metadata: Metadata = {
  title: 'Reset password',
  description: 'Atur password baru untuk akun Athar Anda.',
}

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl">Atur Ulang Password</CardTitle>
        <CardDescription>
          Buat password baru yang aman untuk akun Anda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<div className="h-10" />}>
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  )
}
