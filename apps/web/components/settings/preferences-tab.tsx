'use client'

// Preferences — locale (id/ar), theme (light/dark/auto), calendar (h/m/both).
// Uses the existing `useTheme` + `useCalendarMode` hooks so changes take
// effect immediately. The server is updated on submit via PATCH.

import * as React from 'react'
import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { api, ApiClientError } from '@/lib/api/client'
import { useTheme } from '@/hooks/use-theme'
import { useCalendarMode } from '@/hooks/use-calendar-mode'
import type { ThemeMode } from '@/lib/theme'
import type { CalendarMode } from '@athar/shared'

const prefsSchema = z.object({
  locale: z.enum(['id', 'ar']),
  theme: z.enum(['light', 'dark', 'auto']),
  calendar: z.enum(['h', 'm', 'both']),
})

type PrefsValues = z.infer<typeof prefsSchema>

export interface PreferencesTabInitial {
  locale: 'id' | 'ar'
  theme: ThemeMode
  calendar: CalendarMode
}

interface PreferencesTabProps {
  initial: PreferencesTabInitial
}

export function PreferencesTab({ initial }: PreferencesTabProps) {
  const { setTheme } = useTheme()
  const { setMode: setCalendarMode } = useCalendarMode()
  const [submitting, setSubmitting] = useState(false)

  const {
    handleSubmit,
    control,
    watch,
    reset,
    formState: { isDirty },
  } = useForm<PrefsValues>({
    resolver: zodResolver(prefsSchema),
    defaultValues: {
      locale: initial.locale,
      theme: initial.theme,
      calendar: initial.calendar,
    },
  })

  // Live-preview theme + calendar — apply locally while the user explores,
  // even before they click Simpan. Skip the initial render so the mount of
  // the tab doesn't trigger a redundant server PATCH (`syncThemeToServer`).
  const watchedTheme = watch('theme')
  const watchedCalendar = watch('calendar')
  const firstTheme = React.useRef(true)
  const firstCal = React.useRef(true)

  useEffect(() => {
    if (firstTheme.current) {
      firstTheme.current = false
      return
    }
    setTheme(watchedTheme)
  }, [watchedTheme, setTheme])

  useEffect(() => {
    if (firstCal.current) {
      firstCal.current = false
      return
    }
    setCalendarMode(watchedCalendar)
  }, [watchedCalendar, setCalendarMode])

  async function onSubmit(values: PrefsValues) {
    setSubmitting(true)
    try {
      await api.patch('/users/me/preferences', values)
      toast.success('Preferensi disimpan')
      reset(values, { keepValues: true })
    } catch (e) {
      const msg =
        ApiClientError.is(e)
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Gagal menyimpan preferensi'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferensi</CardTitle>
        <CardDescription>
          Atur bahasa, tema, dan kalender yang digunakan di seluruh aplikasi.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Locale */}
          <fieldset className="space-y-3">
            <Label className="text-sm font-medium">Bahasa UI</Label>
            <Controller
              control={control}
              name="locale"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-wrap gap-4"
                >
                  <label className="inline-flex items-center gap-2">
                    <RadioGroupItem value="id" id="loc-id" />
                    <span>Indonesia</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <RadioGroupItem value="ar" id="loc-ar" />
                    <span>العربية</span>
                  </label>
                </RadioGroup>
              )}
            />
          </fieldset>

          {/* Theme */}
          <fieldset className="space-y-3">
            <Label className="text-sm font-medium">Tema</Label>
            <Controller
              control={control}
              name="theme"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-wrap gap-4"
                >
                  <label className="inline-flex items-center gap-2">
                    <RadioGroupItem value="auto" id="theme-auto" />
                    <span>Auto</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <RadioGroupItem value="light" id="theme-light" />
                    <span>Light</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <RadioGroupItem value="dark" id="theme-dark" />
                    <span>Dark</span>
                  </label>
                </RadioGroup>
              )}
            />
          </fieldset>

          {/* Calendar */}
          <fieldset className="space-y-3">
            <Label className="text-sm font-medium">Kalender</Label>
            <Controller
              control={control}
              name="calendar"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-wrap gap-4"
                >
                  <label className="inline-flex items-center gap-2">
                    <RadioGroupItem value="both" id="cal-both" />
                    <span>Keduanya</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <RadioGroupItem value="h" id="cal-h" />
                    <span>Hijriyah</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <RadioGroupItem value="m" id="cal-m" />
                    <span>Masehi</span>
                  </label>
                </RadioGroup>
              )}
            />
          </fieldset>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || !isDirty}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
