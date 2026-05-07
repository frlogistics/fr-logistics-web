# fr-logistics-website

Public marketing website for FR-Logistics — served at **https://fr-logistics.net**

## Deployment

Deployed via **Netlify** (project `tubular-pastelito-58c7a1`). Pushes to `main` trigger automatic deploys.

| Item | Value |
|------|-------|
| Netlify project | tubular-pastelito-58c7a1 |
| Domain | fr-logistics.net |
| Functions region | US East (us-east-1) |

## Structure

```
/
├── index.html          # Homepage
├── about.html          # About FR-Logistics
├── contact.html        # Contact form
├── ecopack.html        # EcoPack+ landing page
├── fba-prep.html       # FBA Prep landing page
├── latam.html          # LATAM seller landing page
├── pricing.html        # Public pricing calculator
├── portal.html         # Redirect to apps.fr-logistics.net
├── thank-you.html      # Form submission thank-you page
├── 404.html            # Not found page
├── _redirects          # Netlify redirects config
├── robots.txt          # Crawler rules
├── sitemap.xml         # SEO sitemap
├── assets/             # CSS, JS, images, fonts
├── blog/               # Blog posts
└── es/                 # Spanish version of all pages
```

## Editing

### For content edits (text, images)
1. Edit the `.html` file directly in GitHub web UI or locally
2. Commit + push — Netlify deploys automatically in ~30-60s

### For pricing / rates updates
The pricing calculator (`pricing.html`) fetches rates from the FR-Logistics
billing-rates API at runtime. **DO NOT hardcode rates here** —
update them in Supabase `fr_client_rates` (DEFAULT row) and they'll
reflect automatically.

## Related repos

- `frlogistics/fr-logistics-apps` — internal portal (apps.fr-logistics.net)

## Owner

Jose Fuentes · josefuentes@fr-logistics.net · (786) 300-1443
