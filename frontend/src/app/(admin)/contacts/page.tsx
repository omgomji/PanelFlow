'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getContacts, createContact, deleteContact } from '@/lib/api';
import type { Contact } from '@/types/contact';
import ContactDrawer, { type ContactDrawerData } from '@/components/ContactDrawer';
import { Pagination } from '@/components/ui/Pagination';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function ContactsPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });
  const showAlert = (title: string, message: string) => setAlertInfo({ isOpen: true, title, message });
  const closeAlert = () => setAlertInfo(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    fetchContacts(page);
  }, [page]);

  const fetchContacts = async (pageToFetch = page) => {
    try {
      setLoading(true);
      const { data, meta } = await getContacts(pageToFetch, 10);
      setContacts(data);
      setTotalPages(meta.totalPages);
      setTotalItems(meta.total);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContact = async (data: ContactDrawerData) => {
    try {
      setSaving(true);
      const newContact = await createContact(data);
      setContacts((prev) => [newContact, ...prev]);
      setDrawerOpen(false);
    } catch (error) {
      console.error('Error saving contact:', error);
      showAlert('Error', 'Failed to save contact. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveContact = async (id: number) => {
    try {
      setDeleting(id);
      await deleteContact(id);
      setContacts((prev) => prev.filter((contact) => contact.id !== id));
      setTotalItems((prev) => Math.max(0, prev - 1));
      if (contacts.length === 1 && page > 1) {
        setPage(page - 1);
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      showAlert('Error', 'Failed to delete contact. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="pb-20">
      <PageHeader
        title="Contacts"
        description="Manage people you've met through scheduling."
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setDrawerOpen(true)}
          >
            <span className="material-symbols-outlined text-[16px] mr-2">person_add</span>
            Add contact
          </Button>
        }
      />

      <AlertDialog
        isOpen={alertInfo.isOpen}
        title={alertInfo.title}
        message={alertInfo.message}
        onClose={closeAlert}
      />

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center rounded-sm border-2 border-ink bg-paper p-10">
              <div className="h-7 w-7 animate-spin rounded-sm border-b-2 border-stamp border-2" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-ink bg-paper">
              <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-sm bg-clay/10 text-ink/60">
                <span className="material-symbols-outlined text-[20px] font-display font-semibold tracking-wide">inbox</span>
              </div>
              <h2 className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">
                No contacts yet
              </h2>
              <p className="mt-1 text-[11px] text-ink/60">
                Contacts will appear here after someone books with you or when you import them.
              </p>
              <div className="mt-4">
                <Link
                  href="/"
                  className="inline-flex h-8 items-center rounded-sm border-2 border-ink px-3 text-[11px] font-bold text-ink/80 hover:bg-clay/5"
                >
                  Go to Scheduling
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b-2 border-ink bg-clay/5 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-ink/60">
                {totalItems} Contact{totalItems === 1 ? '' : 's'}
              </div>
              <ul className="divide-y divide-slate-200">
                {contacts.map((contact) => (
                  <li key={contact.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium font-bold text-ink">{contact.name}</p>
                        <p className="mt-0.5 text-[12px] font-medium text-ink/70">{contact.email}</p>
                        {contact.phone ? <p className="mt-0.5 text-[12px] font-medium text-ink/70">{contact.phone}</p> : null}
                        {contact.note ? <p className="mt-1 text-[12px] font-medium text-ink/60">{contact.note}</p> : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveContact(contact.id)}
                        disabled={deleting === contact.id}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-ink/60 hover:bg-clay/10 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Remove contact"
                        title="Remove contact"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <ContactDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSaveContact}
      />
    </div>
  );
}
