'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Status = 'loading' | 'ready' | 'success' | 'error'

export default function ResetPasswordPage() {
    const [status, setStatus] = useState<Status>('loading')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [message, setMessage] = useState('')

    useEffect(() => {
        const hash = window.location.hash.substring(1)
        const params = new URLSearchParams(hash)
        const type = params.get('type')
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (type !== 'recovery' || !accessToken || !refreshToken) {
            setMessage('Invalid or expired reset link.')
            setStatus('error')
            return
        }

        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
            if (error) {
                setMessage(error.message)
                setStatus('error')
            } else {
                setStatus('ready')
            }
        })
    }, [])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (password !== confirm) {
            setMessage('Passwords do not match.')
            return
        }
        const { error } = await supabase.auth.updateUser({ password })
        if (error) {
            setMessage(error.message)
        } else {
            setMessage('Password updated successfully. You can now log in.')
            setStatus('success')
        }
    }

    if (status === 'loading') return <main className="p-8">Verifying reset link…</main>

    if (status === 'error') return (
        <main className="p-8">
            <p className="text-red-600">{message}</p>
        </main>
    )

    if (status === 'success') return (
        <main className="p-8">
            <p className="text-green-600">{message}</p>
        </main>
    )

    return (
        <main className="p-8 max-w-sm">
            <h1 className="text-2xl font-bold mb-6">Set new password</h1>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input
                    type="password"
                    placeholder="New password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="border rounded px-3 py-2"
                />
                <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    className="border rounded px-3 py-2"
                />
                {message && <p className="text-red-600 text-sm">{message}</p>}
                <button type="submit" className="bg-black text-white rounded px-4 py-2">
                    Update password
                </button>
            </form>
        </main>
    )
}
