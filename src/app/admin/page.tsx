import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '../../lib/auth';
import { SystemProvider } from '../../context/SystemContext';
import { AdminShell } from '../../components/admin/AdminShell';

export default async function AdminPage() {
  const authContext = await getAuthenticatedUser();

  // Enforce server-side authorization: Reject unauthenticated or non-admin users
  if (!authContext) {
    redirect('/login?redirect=/admin');
  }

  if (authContext.role !== 'ADMIN') {
    redirect('/login?error=unauthorized_admin_access');
  }

  return (
    <SystemProvider>
      <AdminShell initialTab="dashboard" />
    </SystemProvider>
  );
}
