// `/admin` → redirect ke `/admin/dashboard`.
//
// Berada di route group `(admin)` sehingga layout admin (auth + role check)
// tetap berjalan sebelum redirect dieksekusi.

import { redirect } from 'next/navigation'

export default function AdminIndexPage(): never {
  redirect('/admin/dashboard')
}
