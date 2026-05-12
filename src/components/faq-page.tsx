'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'

interface FAQ {
  id: string
  question: string
  answer: string
  order: number
  isActive: boolean
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={`text-[11px] font-medium ${
        active
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-gray-50 text-gray-600 border-gray-200'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </Badge>
  )
}

const emptyForm = {
  question: '',
  answer: '',
  order: 0,
  isActive: true,
}

export default function FAQPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const fetchFAQs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/faq')
      if (res.ok) {
        const data = await res.json()
        const faqList = data.faqs || data || []
        // Sort by order
        faqList.sort((a: FAQ, b: FAQ) => (a.order || 0) - (b.order || 0))
        setFaqs(faqList)
      }
    } catch {
      toast.error('Failed to load FAQs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadFAQs = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/faq')
        if (!cancelled && res.ok) {
          const data = await res.json()
          const faqList = data.faqs || data || []
          faqList.sort((a: FAQ, b: FAQ) => (a.order || 0) - (b.order || 0))
          setFaqs(faqList)
        }
      } catch {
        if (!cancelled) {
          toast.error('Failed to load FAQs')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadFAQs()

    return () => {
      cancelled = true
    }
  }, [])

  const filteredFAQs = faqs.filter(
    (f) =>
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.answer.toLowerCase().includes(search.toLowerCase())
  )

  const handleAdd = async () => {
    if (!form.question.trim()) {
      toast.error('Question is required')
      return
    }
    if (!form.answer.trim()) {
      toast.error('Answer is required')
      return
    }
    setSubmitting(true)
    try {
      const body = {
        ...form,
        order: form.order || faqs.length + 1,
      }
      const res = await fetch('/api/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success('FAQ added successfully')
        setAddDialogOpen(false)
        setForm(emptyForm)
        fetchFAQs()
      } else {
        toast.error('Failed to add FAQ')
      }
    } catch {
      toast.error('Failed to add FAQ')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async () => {
    if (!editingFAQ) return
    if (!form.question.trim()) {
      toast.error('Question is required')
      return
    }
    if (!form.answer.trim()) {
      toast.error('Answer is required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/faq/${editingFAQ.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        toast.success('FAQ updated successfully')
        setEditDialogOpen(false)
        setEditingFAQ(null)
        setForm(emptyForm)
        fetchFAQs()
      } else {
        toast.error('Failed to update FAQ')
      }
    } catch {
      toast.error('Failed to update FAQ')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (faq: FAQ) => {
    try {
      const res = await fetch(`/api/faq/${faq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !faq.isActive }),
      })
      if (res.ok) {
        toast.success(`FAQ ${faq.isActive ? 'deactivated' : 'activated'}`)
        fetchFAQs()
      } else {
        toast.error('Failed to update FAQ')
      }
    } catch {
      toast.error('Failed to update FAQ')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/faq/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('FAQ deleted')
        fetchFAQs()
      } else {
        toast.error('Failed to delete FAQ')
      }
    } catch {
      toast.error('Failed to delete FAQ')
    }
  }

  const handleMoveUp = async (faq: FAQ, index: number) => {
    if (index === 0) return
    const prevFAQ = filteredFAQs[index - 1]
    try {
      await fetch(`/api/faq/${faq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: prevFAQ.order }),
      })
      await fetch(`/api/faq/${prevFAQ.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: faq.order }),
      })
      toast.success('FAQ reordered')
      fetchFAQs()
    } catch {
      toast.error('Failed to reorder FAQ')
    }
  }

  const handleMoveDown = async (faq: FAQ, index: number) => {
    if (index === filteredFAQs.length - 1) return
    const nextFAQ = filteredFAQs[index + 1]
    try {
      await fetch(`/api/faq/${faq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: nextFAQ.order }),
      })
      await fetch(`/api/faq/${nextFAQ.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: faq.order }),
      })
      toast.success('FAQ reordered')
      fetchFAQs()
    } catch {
      toast.error('Failed to reorder FAQ')
    }
  }

  const openEdit = (faq: FAQ) => {
    setEditingFAQ(faq)
    setForm({
      question: faq.question,
      answer: faq.answer,
      order: faq.order,
      isActive: faq.isActive,
    })
    setEditDialogOpen(true)
  }

  const renderForm = () => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="faq-question">Question *</Label>
        <Textarea
          id="faq-question"
          value={form.question}
          onChange={(e) => setForm({ ...form, question: e.target.value })}
          placeholder="Enter the FAQ question"
          rows={2}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="faq-answer">Answer *</Label>
        <Textarea
          id="faq-answer"
          value={form.answer}
          onChange={(e) => setForm({ ...form, answer: e.target.value })}
          placeholder="Enter the answer"
          rows={4}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="faq-order">Display Order</Label>
          <Input
            id="faq-order"
            type="number"
            value={form.order}
            onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            checked={form.isActive}
            onCheckedChange={(v) => setForm({ ...form, isActive: v })}
          />
          <Label>Active</Label>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full min-w-[180px] sm:max-w-sm sm:flex-1">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search FAQs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <Button
            size="sm"
            className="h-8 w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
            onClick={() => {
              setForm({ ...emptyForm, order: faqs.length + 1 })
              setAddDialogOpen(true)
            }}
          >
            <Plus className="size-3.5 mr-1" />
            Add FAQ
          </Button>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New FAQ</DialogTitle>
              <DialogDescription>Create a new frequently asked question.</DialogDescription>
            </DialogHeader>
            {renderForm()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? 'Adding...' : 'Add FAQ'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* FAQs Table */}
      <div className="rounded-md border bg-white">
        <div className="max-h-[600px] overflow-y-auto">
          <Table className="min-w-[500px] sm:min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Order</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="hidden md:table-cell">Answer</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredFAQs.length > 0 ? (
                filteredFAQs.map((faq, index) => (
                  <TableRow key={faq.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground text-xs w-5 text-center">
                          {faq.order}
                        </span>
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            disabled={index === 0}
                            onClick={() => handleMoveUp(faq, index)}
                          >
                            <ChevronUp className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            disabled={index === filteredFAQs.length - 1}
                            onClick={() => handleMoveDown(faq, index)}
                          >
                            <ChevronDown className="size-3" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium max-w-[300px]">
                      <p className="truncate">{faq.question}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground max-w-[250px]">
                      <p className="truncate">{faq.answer}</p>
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={faq.isActive} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(faq)}>
                            <Pencil className="size-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(faq)}>
                            {faq.isActive ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(faq.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No FAQs found. Click &quot;Add FAQ&quot; to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit FAQ</DialogTitle>
            <DialogDescription>Update the FAQ details below.</DialogDescription>
          </DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
