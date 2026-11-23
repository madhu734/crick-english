# Support requests

The website footer links to `/support`. Public submissions are stored in
`ce_support_requests`; they do not change player or team records automatically.
The three required text fields are name, information to change, and replacement
information/message. Up to three JPEG, PNG, WebP or AVIF photos (5 MiB each) are
accepted. Attachments are protected PocketBase files. Only superusers can read,
edit or delete these records; visitors can only create a request and cannot set
review or notification fields.

## Review

Sign into https://pbdb2.duckdns.org/_/ and open `ce_support_requests`.
Review the text and attached photos, make any approved corrections in the
appropriate player/team/history record, then tick `reviewed` on the request.

## Email notifications

`pb_hooks/ce-support.pb.js` runs inside PocketBase, using its existing SMTP
settings. It checks new requests every minute and emails
`www.madhu734@gmail.com`. There are no SMTP credentials or admin tokens in the
website. Email contains the request text and a dashboard link; attachments stay
in the protected collection.

The job handles up to 10 queued records per run. `notification_sent` is filled
only after SMTP accepts the message. Failed messages stay queued and retry on
the next run; `notification_attempts` and `notification_error` help diagnose
problems. SMTP acceptance does not guarantee inbox placement. As with ordinary
email queues, a process crash between sending and saving can produce a duplicate
notification. Submissions remain stored even when email is unavailable.

The production Coolify service is `pbdb2` (`s14aqr1boniqnesedxg24obj`), component
`pocketbase` (`fphpmoxfyf950ltpbinanum1`). Mount the hook file at
`/app/pb_hooks/ce-support.pb.js` in the existing persistent hooks volume,
preserving all other hooks. The production file was installed with a one-off
Coolify container task. Copy updated hook contents into this volume when editing
the hook; the website deployment alone does not deploy PocketBase hooks.
PocketBase reloads changed hooks automatically; restart the component if hooks
watching is disabled. The job is also visible in PocketBase under
Settings → Crons as `ce_support_notifications`.

The additive collection schema is included in `collections.json`. When moving
to another instance, import with Delete missing collections **disabled** and
install the hook separately. Change the recipient in the hook if required.
