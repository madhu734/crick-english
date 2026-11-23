import { useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, ImagePlus, Send } from 'lucide-react';
import { ClientResponseError } from 'pocketbase';
import { publicDb } from './data';
import { BackLink, PageTitle } from './ui';

const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const maxImageSize = 5 * 1024 * 1024;

export function SupportForm() {
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    const form = event.currentTarget;
    const input = new FormData(form);
    const body = new FormData();
    for (const key of ['name', 'current_information', 'replacement_information']) {
      const value = String(input.get(key) ?? '').trim();
      if (!value) { setError('Please complete all three text fields.'); return; }
      body.set(key, value);
    }
    const images = input.getAll('attachments').filter((value): value is File => value instanceof File && value.size > 0);
    if (images.length > 3) { setError('Please choose up to 3 photos.'); return; }
    if (images.some(file => !imageTypes.includes(file.type) || file.size > maxImageSize)) {
      setError('Use JPG, PNG, WebP or AVIF photos, up to 5 MB each.'); return;
    }
    images.forEach(file => body.append('attachments', file));
    submitting.current = true;
    setBusy(true);
    try {
      const saved = await publicDb.collection('ce_support_requests').create(body, { requestKey: null });
      setReference(saved.id);
      form.reset();
    } catch (reason) {
      setError(reason instanceof ClientResponseError && reason.status === 429
        ? 'Too many requests. Please wait a little before trying again.'
        : 'Your request could not be submitted. Your entries are still here. Check your connection and try again, or email support@enggames.tech.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <div className="shell page support-page">
    <BackLink to="/">Back to matches</BackLink>
    <PageTitle kicker="We’re here to help" title="Contact & updates">
      <p>Have a question, a suggestion, or some information to update? Send it to the Crick English committee.</p>
    </PageTitle>
    {reference ? <section className="panel support-confirmation" role="status">
      <CheckCircle2 size={36} aria-hidden="true" />
      <h2>Request received</h2>
      <p>Thank you. The committee will review your request before making any changes.</p>
      <p className="support-reference">Reference: {reference}</p>
      <button type="button" className="button support-submit" onClick={() => setReference('')}>Send another request</button>
    </section> : <form className="panel support-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        <label htmlFor="support-name">Your name</label>
        <input id="support-name" name="name" autoComplete="name" required maxLength={120} placeholder="Your full name" />
        <label htmlFor="support-current">What needs changing?</label>
        <textarea id="support-current" name="current_information" required maxLength={2000} rows={3} placeholder="Tell us whose profile or which information needs updating. You can also leave a question or suggestion." />
        <label htmlFor="support-replacement">New information or message</label>
        <textarea id="support-replacement" name="replacement_information" required maxLength={4000} rows={4} placeholder="Write the correct information or the details you would like us to review." />
        <label htmlFor="support-photos" className="support-photo-label"><ImagePlus size={18} aria-hidden="true" /> Attach photos <span>(optional)</span></label>
        <input id="support-photos" type="file" name="attachments" accept={imageTypes.join(',')} multiple aria-describedby="support-photo-help" />
        <small id="support-photo-help">Up to 3 photos · JPG, PNG, WebP or AVIF · 5 MB each</small>
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="support-privacy">Your message and photos are shared with the committee for review. They will not appear publicly.</p>
      <button type="submit" className="button support-submit" disabled={busy}><Send size={17} aria-hidden="true" />{busy ? 'Submitting…' : 'Submit request'}</button>
      <p className="support-email">Prefer email? <a href="mailto:support@enggames.tech">support@enggames.tech</a></p>
    </form>}
  </div>;
}
