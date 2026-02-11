# TDF 2026 Subscriber nurture email templates

This folder contains HTML and plain-text (.txt) email templates for the post-subscription nurture sequence. Styling matches `lib/email.ts` and is ready for Mailgun or other ESPs. Use the .txt versions as the `text` part in multipart (text/plain + text/html) emails.

## Schedule and purpose

| File | Stage | Send on | Purpose | CTA |
|------|-------|---------|---------|-----|
| `stage-0-welcome.html` / `.txt` | Welcome | Day 0 (immediate) | Welcome + build trust | View ticket options |
| `stage-1-experience.html` / `.txt` | Experience | Day 3 | Paint the picture of the event | Learn about Community Pass |
| `stage-2-social-proof.html` / `.txt` | Social proof | Day 7 | Reduce uncertainty, “everyone’s joining” | Join the crowd |
| `stage-3-bonus.html` / `.txt` | Bonus | Day 10 | Perks and incentives | Claim Welcome Pack |
| `stage-4-deadline.html` / `.txt` | Deadline | Day 14 | Final reminder, natural cutoff | Get your ticket now |

## Email subject (信件標題)

| Stage | Subject |
|-------|---------|
| Welcome (Day 0) | Welcome to Taiwan Digital Fest 2026 |
| Experience (Day 3) | Imagine your TDF 2026 experience |
| Social proof (Day 7) | They're joining—TDF 2026 community is taking shape |
| Bonus (Day 10) | Your perk: claim your Welcome Pack |
| Deadline (Day 14) | Last chance: TDF 2026 registration closing soon |

## URLs (no variables)

All links are fixed; no placeholders.

- **CTA / tickets:** https://fest.dna.org.tw/#tickets  
- **Unsubscribe:** https://fest.dna.org.tw/newsletter/unsubscribe  

## Usage

1. Compute Day 0 / 3 / 7 / 10 / 14 from subscription date and schedule the matching template.
2. Load the HTML (and optional .txt) and send as-is.
3. For multiple languages, duplicate templates and translate body copy, or choose template by locale in your sending logic.

## Design notes

- Inline styles only for broad email client support.
- Primary color for headings and CTAs: `#10B8D9` (cyan). Stage 4 CTA uses `#E74310` (orange) for “last chance” emphasis.
- Layout aligns with existing subscription thank-you and vote confirmation emails for consistency.
