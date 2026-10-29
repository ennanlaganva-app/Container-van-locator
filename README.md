# Container Van Locator

A free, static yard locator for desktop, laptop, and Android phones.

## Use

Open the published site over HTTPS. Upload a loading guide as Excel (`.xlsx` or `.xls`), CSV, TSV, or report photos (`.jpg`, `.jpeg`, `.png`, or `.webp`). Spreadsheet imports read the van number and consignee columns. Photo imports target **Container No.** and **Consignee Name**, skip Seal No. and Shipper Name, and show a review step before importing. The app can also export reviewed photo rows as `Container,Consignee` CSV.

- Five bays (A–E), ten blocks per bay, ten-van working target per block
- Yard view with block inventory and 3 / 3 / 3 / 4 stack reference
- Quick shift with side-by-side block columns and adjacent move buttons
- Search by van number or consignee
- Automatic save in the current browser and JSON backup download
- Shareable yard snapshots
- Android bottom navigation, touch targets, native sharing, and home-screen install support

## Android

Open the HTTPS site in Chrome on Android, open the menu, and choose **Install app** or **Add to Home screen**. The app shell can reopen offline after its first visit. Excel and photo imports need an internet connection to load their browser libraries and OCR model.

## Publish

The GitHub Actions workflow in `.github/workflows/deploy.yml` publishes the site from the repository root whenever `main` changes. In repository **Settings → Pages**, set the build source to **GitHub Actions** once. GitHub Pages is free for public repositories.

The app has no server or shared database. Yard records save in each browser; a snapshot link is a point-in-time view and its data is encoded in the URL fragment.
