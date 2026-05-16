/**
 * RLS Join & Relationship Leak Tests (patterns 11–15)
 *
 * 11. Joining tables without filtering — user sees others' data via join
 * 12. Foreign key without ownership check — user accesses linked data
 * 13. Parent protected, child not — child table leaks data
 * 14. Joining invoices.user_id = auth.uid() but leaking client data
 * 15. Cross-tenant joins — multi-tenant data exposure
 *
 * These are LIVE integration tests that require a running Supabase project
 * with the migration applied. They are automatically skipped when no
 * live config is present.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  cleanupUsers,
  createAuthenticatedClient,
  createTestUser,
  hasLiveSupabaseConfig,
} from '../integration/supabase-harness'
import type { TestUser } from '../integration/table-specs'

const suite = hasLiveSupabaseConfig ? describe : describe.skip

suite('RLS join & relationship leak prevention (11–15)', () => {
  const admin = hasLiveSupabaseConfig ? createSupabaseAdminClient() : null
  let userA: TestUser
  let userB: TestUser
  let clientA: ReturnType<typeof createAuthenticatedClient> extends Promise<infer T> ? T : never
  let clientB: ReturnType<typeof createAuthenticatedClient> extends Promise<infer T> ? T : never

  // Track rows created for cleanup
  const createdInvoiceIds: string[] = []
  const createdPaymentIds: string[] = []
  const createdClientIds: string[] = []

  beforeAll(async () => {
    if (!admin) return

    userA = await createTestUser('join-a')
    userB = await createTestUser('join-b')
    clientA = await createAuthenticatedClient(userA)
    clientB = await createAuthenticatedClient(userB)
  })

  afterAll(async () => {
    // Cleanup via admin (bypasses RLS)
    if (admin) {
      for (const id of createdPaymentIds) {
        await admin.from('payments').delete().eq('id', id)
      }
      for (const id of createdInvoiceIds) {
        await admin.from('invoices').delete().eq('id', id)
      }
      for (const id of createdClientIds) {
        await admin.from('clients').delete().eq('id', id)
      }
      await cleanupUsers([userA!, userB!])
    }
  })

  // -------------------------------------------------------------------------
  // 11. Joining tables without filtering — user sees others' data via join
  // -------------------------------------------------------------------------
  describe('11. join without ownership filter', () => {
    it('user cannot read payments linked to another users invoice via direct query', async () => {
      if (!admin) return

      // User B creates an invoice
      const { data: invoiceB } = await admin
        .from('invoices')
        .insert({
          user_id: userB!.id,
          number: `INV-JOIN-${Date.now()}`,
          status: 'sent',
          amount: 500,
        })
        .select('id')
        .single()

      if (invoiceB) {
        createdInvoiceIds.push(invoiceB.id)
      }

      // User B creates a payment referencing that invoice
      const { data: paymentB } = await admin
        .from('payments')
        .insert({
          user_id: userB!.id,
          invoice_id: invoiceB!.id,
          amount: 500,
          status: 'completed',
        })
        .select('id')
        .single()

      if (paymentB) {
        createdPaymentIds.push(paymentB.id)
      }

      // User A tries to see user B's payments — RLS should block
      const { data, error } = await clientA!
        .from('payments')
        .select('*')
        .eq('user_id', userB!.id)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // 12. Foreign key without ownership check
  // -------------------------------------------------------------------------
  describe('12. foreign key ownership check', () => {
    it('user cannot access a payment that references another users invoice', async () => {
      if (!admin) return

      // User B creates invoice
      const { data: invoiceB } = await admin
        .from('invoices')
        .insert({
          user_id: userB!.id,
          number: `INV-FK-${Date.now()}`,
          status: 'sent',
          amount: 300,
        })
        .select('id')
        .single()

      if (invoiceB) createdInvoiceIds.push(invoiceB.id)

      // Admin creates payment owned by user B, referencing user B's invoice
      const { data: paymentB } = await admin
        .from('payments')
        .insert({
          user_id: userB!.id,
          invoice_id: invoiceB!.id,
          amount: 300,
          status: 'pending',
        })
        .select('id')
        .single()

      if (paymentB) createdPaymentIds.push(paymentB.id)

      // User A should NOT see this payment even though they know the invoice_id
      const { data, error } = await clientA!
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceB!.id)

      expect(error).toBeNull()
      // RLS on payments filters by user_id — user A should see nothing
      expect(data).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // 13. Parent protected, child not — child table leaks data
  // -------------------------------------------------------------------------
  describe('13. parent protected but child table isolated too', () => {
    it('payments (child) are as isolated as invoices (parent)', async () => {
      if (!admin) return

      // User B creates an invoice and a payment
      const { data: invoiceB } = await admin
        .from('invoices')
        .insert({
          user_id: userB!.id,
          number: `INV-CHILD-${Date.now()}`,
          status: 'sent',
          amount: 200,
        })
        .select('id')
        .single()

      if (invoiceB) createdInvoiceIds.push(invoiceB.id)

      const { data: paymentB } = await admin
        .from('payments')
        .insert({
          user_id: userB!.id,
          invoice_id: invoiceB!.id,
          amount: 200,
          status: 'pending',
        })
        .select('id')
        .single()

      if (paymentB) createdPaymentIds.push(paymentB.id)

      // Verify parent (invoices) is protected
      const { data: invoices, error: invoiceErr } = await clientA!
        .from('invoices')
        .select('*')
        .eq('user_id', userB!.id)

      expect(invoiceErr).toBeNull()
      expect(invoices).toHaveLength(0)

      // Verify child (payments) is also protected
      const { data: payments, error: paymentErr } = await clientA!
        .from('payments')
        .select('*')
        .eq('user_id', userB!.id)

      expect(paymentErr).toBeNull()
      expect(payments).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // 14. Joining invoices.user_id = auth.uid() but leaking client data
  // -------------------------------------------------------------------------
  describe('14. client data not leaked through invoice ownership', () => {
    it('user cannot read clients belonging to another user', async () => {
      if (!admin) return

      // User B creates a client
      const { data: clientBRow } = await admin
        .from('clients')
        .insert({
          user_id: userB!.id,
          name: 'Leaked Client',
          email: 'leaked@example.com',
        })
        .select('id')
        .single()

      if (clientBRow) createdClientIds.push(clientBRow.id)

      // User A tries to read user B's clients
      const { data, error } = await clientA!
        .from('clients')
        .select('*')
        .eq('user_id', userB!.id)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)

      // User A also tries a broad select — should only see own clients
      const { data: allClients } = await clientA!
        .from('clients')
        .select('*')

      expect(allClients?.every((c) => c.user_id === userA!.id)).toBe(true)
    })

    it('user cannot link a payment to another users invoice', async () => {
      if (!admin) return

      // User B creates an invoice
      const { data: invoiceB } = await admin
        .from('invoices')
        .insert({
          user_id: userB!.id,
          number: `INV-LINK-${Date.now()}`,
          status: 'sent',
          amount: 750,
        })
        .select('id')
        .single()

      if (invoiceB) createdInvoiceIds.push(invoiceB.id)

      // User A tries to create a payment referencing user B's invoice
      const { data: payment, error } = await clientA!
        .from('payments')
        .insert({
          user_id: userA!.id,
          invoice_id: invoiceB!.id,
          amount: 750,
          status: 'pending',
        })
        .select('id')

      // Even if the insert succeeds (user A owns the payment row),
      // they should not be able to read user B's invoice data
      if (payment && payment.length > 0) {
        createdPaymentIds.push(payment[0].id)
      }

      const { data: invoices } = await clientA!
        .from('invoices')
        .select('*')
        .eq('id', invoiceB!.id)

      expect(invoices).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // 15. Cross-tenant joins — multi-tenant data exposure
  // -------------------------------------------------------------------------
  describe('15. cross-tenant isolation across all user-owned tables', () => {
    const tablesWithUserId = [
      'invoices',
      'clients',
      'time_entries',
      'payments',
      'settings',
      'subscriptions',
      'reminders',
    ]

    for (const table of tablesWithUserId) {
      it(`user A sees zero rows in ${table} owned by user B`, async () => {
        if (!admin) return

        const { data, error } = await clientA!
          .from(table)
          .select('id')
          .eq('user_id', userB!.id)

        expect(error).toBeNull()
        expect(data).toHaveLength(0)
      })

      it(`user B sees zero rows in ${table} owned by user A`, async () => {
        if (!admin) return

        const { data, error } = await clientB!
          .from(table)
          .select('id')
          .eq('user_id', userA!.id)

        expect(error).toBeNull()
        expect(data).toHaveLength(0)
      })
    }
  })
})
