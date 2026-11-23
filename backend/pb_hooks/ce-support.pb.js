// Mount in PocketBase's pb_hooks directory. SMTP credentials stay in PocketBase.
// Persist first, then process the notification queue once per minute. A mail
// outage must never discard a visitor's submission or ask them to submit twice.
cronAdd("ce_support_notifications", "* * * * *", () => {
  const requests = $app.findRecordsByFilter(
    "ce_support_requests", "notification_sent = ''", "created", 10, 0,
  );
  const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
  const settings = $app.settings();
  let config = {};
  try { config = require(__hooks + "/ce-support-config.js"); }
  catch (_) { /* Without a delivery override, use PocketBase SMTP. */ }
  requests.forEach((record) => {
    record.set("notification_attempts", record.getInt("notification_attempts") + 1);
    try {
      const section = (label, value) => "<h3>" + label + "</h3><p style=\"white-space:pre-wrap\">" + escape(value) + "</p>";
      const html = "<h2>New support request</h2>"
          + section("Name", record.getString("name"))
          + section("Information to change / question", record.getString("current_information"))
          + section("New information / message", record.getString("replacement_information"))
          + "<p>Attached photos: " + record.getStringSlice("attachments").length + "</p>"
          + "<p>Reference: " + escape(record.id) + "</p>"
          + "<p><a href=\"https://pbdb2.duckdns.org/_/\">Review requests in PocketBase</a></p>"
          + "<p>Open ce_support_requests, find the reference above, and mark reviewed after checking it. Photos are available after signing in.</p>";
      if (config.emailWebhookUrl) {
        const response = $http.send({
          url: config.emailWebhookUrl, method: "POST", timeout: 30,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reference: record.id, html: html }),
        });
        if (response.statusCode !== 200 || !response.json || !response.json.id) {
          throw new Error("Email delivery service did not confirm sending (HTTP " + response.statusCode + ")");
        }
      } else {
        $app.newMailClient().send(new MailerMessage({
          from: { address: settings.meta.senderAddress, name: "Crick English" },
          to: [{ address: "www.madhu734@gmail.com" }],
          subject: "Crick English: new support request (" + record.id + ")",
          html: html,
        }));
      }
      record.set("notification_sent", new Date().toISOString());
      record.set("notification_error", "");
    } catch (error) {
      record.set("notification_error", String(error).slice(0, 2000));
      $app.logger().error("Crick English support notification failed", "requestId", record.id, "error", String(error));
    }
    // Unsent records remain queued and will be retried on the next run.
    try { $app.save(record); }
    catch (error) { $app.logger().error("Crick English support notification state could not save", "requestId", record.id, "error", String(error)); }
  });
});
