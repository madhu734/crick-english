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

`pb_hooks/ce-support.pb.js` runs inside PocketBase. It checks new requests every
minute and emails `www.madhu734@gmail.com`. Email contains the request text and
a dashboard link; attachments stay in the protected collection.

Production delivery uses the existing Gmail OAuth credential `Bumblebee` in the
[Crick English support notifications workflow](https://n8n.tmadhu.me/workflow/k3OOYOTAWuRiiufE).
PocketBase SMTP was enabled but Gmail rejected its credentials during setup.
The existing SMTP settings were preserved for the other apps on this instance.
The server-only `pb_hooks/ce-support-config.js` exports `{ emailWebhookUrl }` and
holds the private, randomly generated n8n webhook URL. Keep this file out of Git
and the website. A sanitized workflow template is included alongside this guide.
The n8n recipient is fixed; the webhook cannot select a different recipient.
It responds with Gmail's message ID only after successful sending. If the config
file is absent, the hook uses PocketBase SMTP instead. There are no SMTP
credentials, webhook URLs or admin tokens in the website.

The job handles up to 10 queued records per run. `notification_sent` is filled
only after Gmail (or SMTP in fallback mode) accepts the message. Failed messages stay queued and retry on
the next run; `notification_attempts` and `notification_error` help diagnose
problems. Email acceptance does not guarantee inbox placement. As with ordinary
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
install the hook and private config separately. Change the recipient in the n8n
Gmail node (and the SMTP fallback in the hook) if required.
