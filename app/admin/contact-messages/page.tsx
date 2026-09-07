'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ContactMessage = {
    id: number
    name: string
    email: string
    message: string
    is_read: boolean
    created_at: string
}

type Filter = 'all' | 'unread' | 'read'

export default function ContactMessagesPage() {
    const router = useRouter()
    const [messages, setMessages] = useState<ContactMessage[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [filter, setFilter] = useState<Filter>('all')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [authChecked, setAuthChecked] = useState(false)

    const fetchMessages = useCallback(async (targetPage: number, targetFilter: Filter) => {
        setLoading(true)
        setError('')

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            router.push('/admin/login')
            return
        }

        const params = new URLSearchParams({ page: String(targetPage), limit: '20' })
        if (targetFilter !== 'all') params.set('is_read', String(targetFilter === 'read'))

        const res = await fetch(`/api/contact?${params.toString()}`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
        })

        if (res.status === 401) {
            router.push('/admin/login')
            return
        }

        if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            setError(body.error || 'Failed to load messages')
            setLoading(false)
            return
        }

        const body = await res.json()
        setMessages(body.data)
        setTotalPages(body.pagination.totalPages)
        setUnreadCount(body.unread_count)
        setLoading(false)
    }, [router])

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                router.push('/admin/login')
                return
            }
            setAuthChecked(true)
        })
    }, [router])

    useEffect(() => {
        if (authChecked) fetchMessages(page, filter)
    }, [authChecked, page, filter, fetchMessages])

    async function toggleRead(msg: ContactMessage) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            router.push('/admin/login')
            return
        }

        const res = await fetch(`/api/contact/${msg.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ is_read: !msg.is_read })
        })

        if (res.ok) {
            const updated = await res.json()
            setMessages(prev => prev.map(m => m.id === updated.id ? updated : m))
            setUnreadCount(c => updated.is_read ? Math.max(0, c - 1) : c + 1)
        }
    }

    function toggleExpand(msg: ContactMessage) {
        const nowExpanded = expandedId !== msg.id
        setExpandedId(nowExpanded ? msg.id : null)
        if (nowExpanded && !msg.is_read) toggleRead(msg)
    }

    if (!authChecked) return <main className="p-8">Checking session…</main>

    return (
        <main className="p-8 max-w-4xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Contact Us messages</h1>
                <span className="text-sm text-gray-600">{unreadCount} unread</span>
            </div>

            <div className="flex gap-2 mb-4">
                {(['all', 'unread', 'read'] as Filter[]).map(f => (
                    <button
                        key={f}
                        onClick={() => { setFilter(f); setPage(1) }}
                        className={`px-3 py-1 rounded border text-sm capitalize ${filter === f ? 'bg-black text-white' : 'bg-white text-black'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

            {loading ? (
                <p>Loading…</p>
            ) : messages.length === 0 ? (
                <p className="text-gray-600">No messages found.</p>
            ) : (
                <div className="flex flex-col gap-2">
                    {messages.map(msg => (
                        <div key={msg.id} className="border rounded">
                            <button
                                onClick={() => toggleExpand(msg)}
                                className="w-full text-left px-4 py-3 flex items-center justify-between gap-4"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {!msg.is_read && (
                                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" title="Unread" />
                                    )}
                                    <div className="min-w-0">
                                        <p className={`truncate ${msg.is_read ? 'font-normal' : 'font-semibold'}`}>
                                            {msg.name} <span className="text-gray-500">&lt;{msg.email}&gt;</span>
                                        </p>
                                        <p className="text-sm text-gray-600 truncate">{msg.message}</p>
                                    </div>
                                </div>
                                <div className="text-sm text-gray-500 shrink-0 text-right">
                                    {new Date(msg.created_at).toLocaleString()}
                                </div>
                            </button>

                            {expandedId === msg.id && (
                                <div className="px-4 pb-4 border-t pt-3">
                                    <p className="whitespace-pre-wrap mb-3">{msg.message}</p>
                                    <button
                                        onClick={() => toggleRead(msg)}
                                        className="text-sm border rounded px-3 py-1"
                                    >
                                        Mark as {msg.is_read ? 'unread' : 'read'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex gap-2 mt-6 items-center">
                    <button
                        disabled={page <= 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="text-sm">Page {page} of {totalPages}</span>
                    <button
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}
        </main>
    )
}
