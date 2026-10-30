# Container Van Locator

A free, static yard locator for desktop, laptop, Android phones, and tablets.

## Features

- Yard layout: Bay A (11 blocks), Bay B (12), Bay C (7), Bay D front/back (5 each), and Bay E front/back (7 each), for 54 blocks and 594 positions.
- Block labels identify bay and side, such as A1, D-F1, and E-B1.
- Four physical stack lanes with capacities 3 / 3 / 3 / 2. Each van gets an exact stack and level; accessible position numbers recalculate after a move.
- Yard view that highlights a searched van in its exact stack position.
- Quick shift follows the yard map and moves vans between any two blocks, including across bays and between front/back sections. The current working scroll position stays in place after a move.
- Search results include direct Bay/side and block assignment.
- Status dates for CY Stripped and Withdrawn, with a History page for incoming full vans, withdrawals, status changes, and location moves.
- Import Excel, CSV, TSV, and loading guide photos. Photo review can export a CSV with van number, consignee, vessel, and voyage.
- Additional guides add new vans and update consignee, vessel, and voyage on existing records while keeping their yard location and status.
- Print-ready Picking Tags with a manually entered FL operator.
- Automatic save in the current browser, JSON backups, and point-in-time share links.
- Android touch layout and a landscape tablet layout. The app supports home-screen installation.

Older Bay D/E locations are mapped to their front/back sections. Older Bay C locations in blocks 8–10 remain in the list as awaiting location because Bay C now has only seven blocks; assign those vans to a current block.

## Storage and sharing

The app has no server or shared database yet. Records and history save in each browser. A share link is a point-in-time snapshot, not live syncing. Back up the list before moving it to another device.

## Android

Open the HTTPS site in Chrome on Android, open the menu, and choose **Install app** or **Add to Home screen**. The app shell can reopen offline after its first visit. Excel and photo imports need an internet connection to load their browser libraries and OCR model.

## Publish

The GitHub Actions workflow in `.github/workflows/deploy.yml` publishes the site from the repository root whenever `main` changes. In repository **Settings → Pages**, set the build source to **GitHub Actions** once. GitHub Pages is free for public repositories.
