# QA

`npm run dev` and `npm run build` run this first. A failing check does not start the page.

## Automatic

`npm run qa` checks the current `CLIENT`:

- Colors are hex, logo under 40 KB, hero under 200 KB, URLs are https
- Button text on the button is at least 4.5:1
- Button stands out from the page background (3:1)
- Body text on the background is at least 4.5:1
- The rendered page sets brand colors **after** `styles.css`, and sets the CTA from those variables
- The stylesheet does not still contain the example green (`#b8f26d`)
- There is one action, the label is on the page, and a form still has its honeypot

Then a Chrome window opens on top of your work. Each button is outlined, then clicked. QA reads the colors Chrome actually painted and fails if the label disappears into the fill. The window closes after the click.

QA strips `FORM_ENDPOINT` and every pixel ID before it renders, so the click cannot post a lead or call Meta, Google, or TikTok. With those values set in `.env`, a normal `npm run dev` still uses them. Only the check is blank.

`QA_HEADLESS=1` runs the same click without a window. CI sets that. No Chrome means QA fails. Set `CHROME_PATH` if Chrome is not in the usual place.

## Still a person

The script cannot see the ad. Before you spend, on a phone:

1. The headline uses the same words as the ad.
2. The logo and hero are this client's files, not the draft monogram.
3. You can read the button without guessing.
4. One test lead arrives at your endpoint with the UTMs.
