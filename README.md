# Solicitation browser

A vendor's morning list of DIBBS requests for quotation. Search for a part, see what is closing soon, and open the original record.

```bash
npm start
```

Open http://localhost:3000. The first load downloads the newest daily file from DIBBS, which takes a few seconds.

```bash
npm test
npm run extract -- --date 2026-11-08
```

`npm run extract` writes `data/rfqs.json` and does not start the page.

## Finding an opportunity

The list is sorted by return date, soonest first. A quote you cannot turn in is not worth opening.

- Search matches the solicitation, the NSN, or the item name. Dashes are ignored, so `8465-01-560-7762` and `8465015607762` hit the same row.
- Closing in 7 or 14 days keeps only quotes due inside that window.
- Min qty drops small buys.
- Fifty rows per page. The solicitation number opens that RFQ on DIBBS.

## Where the rows come from

DIBBS does not offer an API. Each posted day is one fixed-width file, `Downloads/RFQ/Archive/inYYMMDD.txt`, one line item per line. The first response is the Department of Defense consent page. The downloader submits OK, keeps the cookie, and reads the file. Today's file is often not published yet, so the app walks back up to 10 days and uses the newest one.

A line carries the solicitation number, the NSN when the line has one, the quantity, the unit, a 21-character item name, and the return-by date. The posted date on the row is the date in the filename.

## Columns that are not from DIBBS

The daily file does not include how many quotes have been submitted, or anyone's price. Quotes are sealed unit prices. Vendors do not see each other's offers, so this is not a bidding war.

Bids is a placeholder from 0 to 8, stable for a solicitation. Value is the quantity times a made-up unit price, so a large buy is obvious. Hover a value to see the unit price. Neither number comes from DIBBS.

The item name stops at 21 characters because that is the width of the field. `INSULATION SLEEVING,ELECTRICAL` arrives as `INSULATION SLEEVING,E`. The characters after that are a buyer code, not the rest of the word. The full name is on the RFQ's own page.

## What I optimized for

I used the daily file instead of the search grid. One request returns the whole day, and the layout does not depend on HTML. I kept the screen to the questions a vendor asks first: is this my part, is the quantity worth it, and can I still quote it? Set-asides, buyer codes, and approved-source flags are in the file and stayed off the table.
