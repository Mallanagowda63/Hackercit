// Branded HTML email for admin announcements. Table-based with inline styles so it renders the
// same in Gmail (web + app), Outlook and Apple Mail; explicit colours keep dark mode readable.

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// One message line -> HTML. Short "Label: value" lines get a bold label; "- item" lines become bullets.
function formatLine(line) {
  const safe = escapeHtml(line);
  const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
  if (bullet) return `<span style="color:#6d28d9;font-weight:700">&#8226;</span>&nbsp; ${escapeHtml(bullet[1])}`;
  if (/^[^:]{2,60}:\s*$/.test(line)) return `<strong style="color:#111827">${safe}</strong>`;
  const labelled = line.match(/^([^:]{2,24}):\s+(.+)$/);
  if (labelled) return `<strong style="color:#111827">${escapeHtml(labelled[1])}:</strong> ${escapeHtml(labelled[2])}`;
  return safe;
}

function messageToHtml(message) {
  return String(message)
    .split(/\n{2,}/)
    .map((block) => block.split('\n').map(formatLine).join('<br>'))
    .map((block) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151">${block}</p>`)
    .join('');
}

function renderAnnouncementEmail({ subject, message, name, link, linkLabel = 'Open DevOrbit', eyebrow = 'Announcement', icon = '&#127942;' }) {
  const greeting = `Hi ${name},`;
  const preheader = String(message).split('\n').find((line) => line.trim()) || subject;
  const text = `${greeting}\n\n${message}\n\n${link ? `${linkLabel}: ${link}\n\n` : ''}- Team DevOrbit`;
  const font = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

  const button = link
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 6px">
        <tr><td align="center" bgcolor="#4f46e5" style="border-radius:10px;background:#4f46e5;background-image:linear-gradient(135deg,#4f46e5,#7c3aed)">
          <a href="${escapeHtml(link)}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${font};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">${escapeHtml(linkLabel)} &rarr;</a>
        </td></tr>
      </table>`
    : '';

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#eef0f7" bgcolor="#eef0f7">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#eef0f7">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef0f7" style="background:#eef0f7">
<tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;font-family:${font}">

    <tr><td bgcolor="#4338ca" style="background:#4338ca;background-image:linear-gradient(135deg,#312e81 0%,#4f46e5 55%,#7c3aed 100%);padding:34px 28px 30px;border-radius:16px 16px 0 0">
      <div style="font-size:34px;line-height:1;margin-bottom:12px">${icon}</div>
      <div style="font-family:${font};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#c7d2fe;margin-bottom:8px">${escapeHtml(eyebrow)}</div>
      <div style="font-family:${font};font-size:24px;line-height:1.3;font-weight:800;color:#ffffff">${escapeHtml(subject)}</div>
    </td></tr>

    <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:30px 28px 10px">
      <p style="margin:0 0 16px;font-size:17px;font-weight:700;color:#111827">${escapeHtml(greeting)}</p>
      ${messageToHtml(message)}
      ${button}
    </td></tr>

    <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px 28px 28px;border-radius:0 0 16px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="#f5f3ff" style="background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:8px;padding:12px 16px;font-family:${font};font-size:13px;line-height:1.6;color:#4c1d95">
          Log in with the Gmail address you registered with on DevOrbit. All the best!
        </td>
      </tr></table>
      <p style="margin:22px 0 0;font-size:15px;color:#374151">Cheers,<br><strong style="color:#111827">Team DevOrbit</strong></p>
    </td></tr>

    <tr><td align="center" style="padding:20px 16px 8px;font-family:${font};font-size:12px;line-height:1.6;color:#8a8fa3">
      You're receiving this because you're registered on DevOrbit by ScholarLogic.<br>
      ${link ? `<a href="${escapeHtml(link)}" style="color:#6d28d9;text-decoration:none">${escapeHtml(link.replace(/^https?:\/\//, ''))}</a>` : ''}
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`;

  return { subject, text, html };
}

module.exports = { renderAnnouncementEmail };
