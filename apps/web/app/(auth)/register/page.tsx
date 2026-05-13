import type { Metadata } from 'next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = {
  title: 'Daftar',
  description: 'Buat akun Athar baru dan mulai trial 3 hari.',
}

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl">Daftar Akun Baru</CardTitle>
        <CardDescription>
          Trial 3 hari gratis. Tidak perlu kartu kredit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  )
}
