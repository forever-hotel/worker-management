

\# WKMS PWA Installation and Verification



\## Requirement



\- Issue: DDP-194 / GitHub Issue #54

\- SRS: WM-P01 — PWA Support

\- Follow-up: WM-P02 — Offline Experience



\## Implementation



The WKMS Next.js frontend provides:



\- A web app manifest at `/manifest.webmanifest`

\- Temporary Forever Hotel application icons (192x192 and 512x512)

\- Standalone display mode

\- The existing WKMS navy and cream theme

\- Mobile application metadata

\- Existing protected navigation, REST APIs and Socket.IO integration



The temporary application icons can be replaced when the team finalizes the hotel logo.



\## Installation



1\. Build the frontend with `npm run build`.

2\. Start it using `npm run start -- -p 3001`.

3\. Open `http://localhost:3001` in Chrome.

4\. Use Chrome's Install app control.

5\. Install WKMS and launch it from the desktop or Start Menu.



For installation on a separate mobile device, use an appropriately configured HTTPS deployment. The development server's private network address does not automatically provide a secure installation origin.



\## Verified Results



\- Manifest returned valid JSON.

\- Both PWA icons returned HTTP 200 with `image/png`.

\- Chrome displayed the installation dialog.

\- WKMS installed and launched in a standalone desktop window.

\- PWA manifest tests: 4 passed.

\- Complete frontend tests: 127 passed across 21 suites.

\- TypeScript, lint and production build: passed.

\- Production dependency audit: 0 vulnerabilities.



\## Remaining Verification



\- Installation on a supported physical mobile device.

\- Authenticated worker navigation within the installed PWA.

\- Final staging/HTTPS deployment smoke test.

\- GitHub Actions CI and peer review.



\## Scope Boundaries



Offline task caching, offline mutations, synchronization and conflict resolution are not implemented under DDP-194. These belong to WM-P02.



The API Gateway Socket.IO proxy is being implemented separately by the infrastructure team. No API Gateway changes are included here.



