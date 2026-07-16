'use client';

import { useEffect, useState } from 'react';
import { isSignInWithEmailLink, sendSignInLinkToEmail, signInAnonymously, signInWithEmailLink } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function completeEmailSignIn() {
      if (!isSignInWithEmailLink(auth, window.location.href)) return;
      const storedEmail = window.localStorage.getItem('emailForSignIn') ?? window.prompt('Confirm your email') ?? '';
      if (!storedEmail) return;
      await signInWithEmailLink(auth, storedEmail, window.location.href);
      window.localStorage.removeItem('emailForSignIn');
      setMessage('Email sign-in complete.');
    }
    completeEmailSignIn();
  }, []);

  async function guest() {
    await signInAnonymously(auth);
    setMessage('Guest account created for this device.');
  }

  async function emailLink() {
    await sendSignInLinkToEmail(auth, email, { url: `${window.location.origin}/auth`, handleCodeInApp: true });
    window.localStorage.setItem('emailForSignIn', email);
    setMessage('Email sign-in link sent.');
  }

  return (
    <main className="mx-auto max-w-lg space-y-5 px-5 py-10">
      <h1 className="text-3xl font-bold">Save your routines</h1>
      <button className="w-full rounded-full bg-clay px-6 py-4 font-semibold text-white" onClick={guest}>Continue as guest</button>
      <div className="rounded-3xl bg-white p-5 shadow-soft">
        <label className="grid gap-2 text-sm font-medium">Email
          <input className="rounded-xl border p-3" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        </label>
        <button className="mt-4 w-full rounded-full bg-sage px-6 py-3 font-semibold text-white" onClick={emailLink} disabled={!email}>Send email code/link</button>
      </div>
      {message && <p className="rounded-xl bg-white p-3 text-sm text-sage shadow-soft">{message}</p>}
    </main>
  );
}
