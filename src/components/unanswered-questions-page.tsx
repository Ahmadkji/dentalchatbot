'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface UnansweredQuestion {
  id: string
  conversationId: string | null
  question: string
  sourcePage: string | null
  status: 'open' | 'answered' | 'ignored'
  answer: string | null
  createdAt: string
}

export default function UnansweredQuestionsPage() {
  const [rows, setRows] = useState<UnansweredQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<UnansweredQuestion | null>(null)
  const [answer, setAnswer] = useState('')
  const [addToFaq, setAddToFaq] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/unanswered-questions')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Failed to load unanswered questions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchRows()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchRows])

  const openAnswer = (row: UnansweredQuestion) => {
    setActive(row)
    setAnswer(row.answer || '')
    setAddToFaq(true)
    setOpen(true)
  }

  const saveAnswer = async () => {
    if (!active) return
    if (!answer.trim()) {
      toast.error('Answer is required')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/unanswered-questions/${active.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer,
          status: 'answered',
          addToFaq,
        }),
      })
      if (!res.ok) throw new Error('Failed to save answer')
      toast.success(addToFaq ? 'Answer saved and added to FAQ' : 'Answer saved')
      setOpen(false)
      setActive(null)
      setAnswer('')
      fetchRows()
    } catch {
      toast.error('Failed to save answer')
    } finally {
      setSaving(false)
    }
  }

  const markIgnored = async (id: string) => {
    try {
      const res = await fetch(`/api/unanswered-questions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ignored' }),
      })
      if (!res.ok) throw new Error('Failed to ignore')
      toast.success('Question ignored')
      fetchRows()
    } catch {
      toast.error('Failed to ignore question')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Unanswered Questions Inbox</h2>
        <p className="text-sm text-muted-foreground">
          Review low-confidence questions, add approved answers, and teach the chatbot directly from real conversations.
        </p>
      </div>

      <div className="rounded-md border bg-white">
        <Table className="min-w-[480px] sm:min-w-[550px]">
          <TableHeader>
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead className="hidden md:table-cell">Source Page</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell><Skeleton className="h-4 w-52" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="ml-auto h-8 w-20" /></TableCell>
                </TableRow>
              ))
            ) : rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.question}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{row.sourcePage || '—'}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        row.status === 'open'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : row.status === 'answered'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                      }
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => openAnswer(row)}>
                      Add Answer
                    </Button>
                    {row.status === 'open' && (
                      <Button size="sm" variant="ghost" onClick={() => markIgnored(row.id)}>
                        Ignore
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No unanswered questions right now.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Answer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-slate-50 p-3 text-sm">
              {active?.question}
            </div>
            <Textarea
              rows={7}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Write the approved clinic answer..."
            />
            <div className="flex items-center gap-2">
              <Checkbox id="add-to-faq" checked={addToFaq} onCheckedChange={(checked) => setAddToFaq(Boolean(checked))} />
              <label htmlFor="add-to-faq" className="text-sm text-muted-foreground">
                Also add this answer to FAQ builder
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveAnswer} disabled={saving}>
              {saving ? 'Saving...' : 'Save Answer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
