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

Then it opens the page in Chrome, reads the **computed** button colors, and clicks the CTA. Source text is not enough. If the label is the same color as the fill, this fails even when `brand.json` looks fine. Set `CHROME_PATH` if Chrome is not in the default location. No Chrome means QA fails.

## Still a person

The script cannot see the ad. Before you spend, on a phone:

1. The headline uses the same words as the ad.
2. The logo and hero are this client's files, not the draft monogram.
3. You can read the button without guessing.
4. One test lead arrives at your endpoint with the UTMs.
