TixGrab

Version: 1.1.0\
 • Author: Jass\
 • Platform: Tampermonkey\
 • Runs on: Ticketmaster domains only

Overview

TixGrab is a small Tampermonkey userscript by Jass that speeds up seat selection on Ticketmaster seat maps. Instead of clicking every seat of a group yourself and then hunting for the Reserve button, you hold Shift and click one seat. TixGrab works out which seats are connected to it, selects them one after another as fast as the page allows, and clicks Reserve Tickets. It also deals with the common pop-ups along the way and tells you what is happening through a live log and short sound cues.

TixGrab is an assistance tool. It does not guarantee that seats will be available, selected or reserved. Website layouts and booking flows can change at any time.

Features

- One Shift + click selects a whole connected group of seats.
- Seats are picked one by one at high speed, with a tick on each seat.
- Automatic click on Reserve Tickets once the seats are in.
- Quantity control: max (every connected seat) or a fixed limit from 1 to 8.
- Respects the event's ticket limit, including limits announced in pop-ups.
- Single-seat guard so a selection does not leave a lone seat open.
- Automatic handling of common pop-ups (for example *Agree & Continue* for wheelchair seats).
- Error pop-ups are dismissed and announced with a distinct sound, so you know to pick other seats.
- Compact, movable, colour-coded control panel with a live log.
- Sound cues for every important step.
- Stays out of the way on queue, login, checkout, payment and similar pages.

Supported websites

TixGrab runs only on Ticketmaster domains. The script header currently matches ticketmaster. followed by: com, ca, co.uk, com.au, co.nz, ie, de, fr, es, it, nl, be, at, ch, dk, fi, no, se, pl, cz, ae, sg, co.za, cl, com.mx and com.br. If your country is missing, add another line in the same style to the script header, for example // @match https://*.ticketmaster.xx/*.

Requirements

- A desktop browser with the Tampermonkey extension installed and enabled.
- The TixGrab userscript installed and enabled.
- A supported Ticketmaster page with a seat map.

The script runs at document-start, does not run inside frames, and does not request any Tampermonkey privileged APIs (@grant none).

Installation

- Install Tampermonkey from your browser's extension store and pin it to the toolbar if you like.
- Open the Tampermonkey menu and choose Dashboard.
- Select Create a new script.
- Delete the default template code.
- Copy the entire contents of tixgrab.user.js, including the userscript header at the very top (// ==UserScript==), and paste it into the editor.
- Save with Ctrl + S (Cmd + S on macOS).
- Confirm TixGrab appears in the Dashboard and is enabled.
- Refresh your Ticketmaster page.

Keep the header intact. Tampermonkey reads @name and @match from it to know where the script may run.

Updating: open the existing TixGrab script in the Dashboard, replace its whole contents with the new version, and save.

Quick start

- Open a Ticketmaster event and get to the seat map.
- Press Shift + T to show the control panel (press it again to hide it).
- Check that power is on and set quantity the way you want.
- Hold Shift and click a single available seat.
- Watch the log. TixGrab selects the connected seats, clicks Reserve Tickets, and, if the reservation takes you to checkout, plays a short chime.

The control panel

Press Shift + T to toggle the panel. It is hidden by default and stays hidden on pages where TixGrab is switched off (see *Pages TixGrab ignores*). Drag the header to move the panel anywhere on the screen. The hotkey is ignored while you are typing in a text field, so capital T in a search box will not open it.

The panel is drawn like a small piece of syntax-coloured JSON:

_tixgrab [↻]
by_jass
{
 "power": [switch],
 "quantity": ["max"],
 "reserve": ["auto"],
 "sound": [true],
 "guard": [true],
 "popups": [true]
}
[ live log ]
// shift+t to hide_

Header

- \_tixgrab / by_jass the script name and author credit.
- ↻ (reset button) cancels anything TixGrab is currently doing, clears the log, forgets the ticket limit it learned and clears the "just reserved" marker used for the checkout chime. Your option settings are kept.

power

The master switch. On by default.

- On: Shift + click works and the script reacts to pop-ups.
- Off: TixGrab stops whatever it is doing and ignores clicks, so the page behaves exactly as normal.

quantity

How many seats to take from the connected group you clicked. Click the value to cycle through "max", 1, 2, 3, 4, 5, 6, 7, 8 and back to "max".

- "max": take every connected seat, up to the cap.
- A number: take only that many connected seats, always including the seat you clicked. If the group is smaller than the number, the whole group is taken.

The cap is 8 seats, or lower if the event announces a smaller ticket limit. Quantity always starts on "max" when a page loads; it is intentionally not remembered between page loads.

reserve

What happens after the seats are selected.

- "auto": TixGrab clicks Reserve Tickets for you as soon as the seats are in. This is the default.
- "off": TixGrab only selects the seats and stops. You click Reserve yourself, which is handy when you want to look at the seats and prices first.

sound

Turns all sound cues on (true) or off (false). Switching it on plays a test tick. See *Sound cues* below.

guard

The single-seat guard (true by default). Ticketmaster often refuses a selection that leaves exactly one seat stranded next to it. With the guard on, if your quantity would leave a single seat open at either end of the group, TixGrab takes that extra seat as well, as long as the cap allows it. With the guard off, you get exactly the number of seats the quantity says.

popups

Automatic pop-up handling (true by default). With it on, TixGrab dismisses common blocking pop-ups for a short time after you start a grab (see *Pop-ups* below). With it off, you handle every pop-up yourself and TixGrab will not react to ticket-limit, single-seat or error messages either.

Colour guide

- Title: _tix purple, grab yellow; author line green.
- Each option name has its own colour.
- Values are coloured by type: text values in lime, numbers in orange, true in purple, and anything switched off in red.
- Log lines use the same idea: every key has its own colour, numbers are orange, booleans purple, text lime, and error-style messages red.
- Everything is shown in lowercase with a soft glow.

How it works

- Shift + click

TixGrab only reacts to a plain Shift + left click (no Ctrl, Alt or Command held) on an available seat while power is on. The click is captured so the page does not also process it as an ordinary click. If the spot under the pointer is not a selectable seat, or the seat is already selected, taken or disabled, the click is left alone and the page behaves normally.

- Finding the connected seats

TixGrab looks at the seats around your click and builds a picture of the seat layout:

- It only considers seats of roughly the same size as the one you clicked.
- It only treats a seat as available if the page presents it as selectable and not sold, taken, disabled or already selected.
- It only keeps seats of the same kind as your seat, judged by colour. A blue seat will not join grey (unavailable) seats or seats of a different price tier, such as gold star seats.
- It works out the local direction of each row, including curved rows, and links neighbouring seats along the row only. Seats in the row above or below are not joined, so separate rows stay separate groups.
- A gap, an unavailable seat, an already selected seat or a seat of another kind ends the group.

The result is the connected group your click belongs to, whether you clicked an end seat or one in the middle.

- Choosing which seats

From the connected group, TixGrab picks a run of seats that always contains the seat you clicked:

- With "max" it takes the whole group, up to the cap (8 or the event's limit).
- With a number it takes that many, choosing the run that sits most naturally around your seat and, when the guard is on, avoids leaving a single seat stranded.
- Groups smaller than the requested number are taken in full.

- Selecting one by one, as fast as possible

The seats are then selected one at a time, quickly. For each seat TixGrab clicks it, waits only until the page shows it as selected, and moves straight on to the next. If a seat does not register it is clicked once more and, if it still does not register, skipped. Each selected seat plays a tick and adds a line to the log.

- Reserving

When the seats are in, TixGrab looks for the Reserve Tickets button, waits for it to become enabled, and clicks it (unless reserve is set to "off"). A different, lower tick plays and the log shows reserve: clicked. If it cannot find the button, or the button stays disabled, the log tells you.

TixGrab also remembers for a few minutes that it just reserved, so the next step can be recognised.

- Confirming the reservation

If the reservation takes you to a checkout or authorization page within about ten minutes, a short rising chime plays and the log shows done: reserved. This is your signal that the seats were actually reserved and you can continue manually.

Ticket limits

- The default cap is 8 seats.
- If a pop-up announces a lower per-order limit (for example *ticket limit is 4*), TixGrab learns it, stops selecting further seats, clicks OK, deselects any extras, and reserves only up to that limit. The learned limit is used for later grabs on the same page.
- The ↻ button forgets the learned limit.

Pop-ups

For about ten seconds after you start a grab, and again after it presses Reserve, TixGrab watches for pop-ups and presses the sensible button on them:

- Confirmation pop-ups, including the wheelchair/accessible seat prompts: it presses buttons such as *Agree & Continue*, *Accept & Continue*, *Continue*, *Agree*, *Accept*, *OK*, *Got it*, *Confirm* or *Close*, then carries on and reserves.
- Ticket-limit pop-ups: handled as described above.
- Single-seat pop-ups: if the site warns that a seat would be left on its own after you pressed Reserve, TixGrab dismisses the warning, selects the neighbouring seat that would have been stranded, and presses Reserve again.
- Error pop-ups (for example *something went wrong*, *sorry*, *tickets are not available*, *try again*): TixGrab presses OK, stops the current run, plays an error sound, and logs error: tickets not available. It does not try again on its own. Pick other seats and Shift + click again.

TixGrab deliberately ignores the ticket-selection side panel and never presses buttons that remove or delete tickets.

Sound cues

All sounds respect the sound option.

 Moment: Each seat selected. Sound: A short, light tick (kept slightly apart so four seats sound like four ticks)

 Moment: Reserve Tickets pressed. Sound: A different, lower, slightly longer tick

 Moment: Page changes to checkout or authorization after a reserve. Sound: A short, cute rising chime

 Moment: Error pop-up dismissed. Sound: A short descending error sound

Browsers sometimes keep audio paused on a freshly loaded page until you interact with it. If the chime on the checkout page does not play, a mouse move or key press will release it.

Pages TixGrab ignores

TixGrab switches itself off, hides its panel and stays out of the way when the address contains any of: queue, checkout, authorization (or authorisation), login, signin / sign-in, payment, captcha or waiting-room. The one thing it still does on the checkout and authorization pages is play the confirmation chime if you just reserved.

TixGrab does not wait in queues for you, solve captchas, sign you in or go through payment.

Settings and memory

- power, reserve, sound, guard and popups are remembered for the current browser tab only.
- quantity always starts on "max" on a fresh page.
- Nothing is stored on disk and nothing is sent anywhere.

Reading the log

Each log line is a small JSON object starting with a time stamp (t). The most common ones:

 Line: `pack`, `pick`, `want`, `scan`. Meaning: How many connected seats were found, how many will be taken, your quantity setting, and how long the scan took in milliseconds

 Line: `pack: 0`. Meaning: No selectable seat was found under your click

 Line: `selected: 2, of: 4, ms: ...`. Meaning: The second of four seats is now selected

 Line: `selected: missed`. Meaning: A seat did not register and was skipped

 Line: `selected: extra`. Meaning: An extra seat was added to avoid leaving a single seat open

 Line: `reserve: clicked`. Meaning: Reserve Tickets was pressed (with the time taken)

 Line: `reserve: skipped`. Meaning: No seat registered, so nothing was reserved

 Line: `reserve: off`. Meaning: Seats were selected but you chose to reserve manually

 Line: `reserve: button not found` / `button not ready`. Meaning: The Reserve button could not be found or never became enabled

 Line: `dialog: cleared`. Meaning: A pop-up was dismissed, with the button pressed and the start of its text

 Line: `limit`. Meaning: A ticket limit was announced; extra seats were dropped if needed

 Line: `orphan`. Meaning: The single-seat handling needed to give up or found no seat

 Line: `error: tickets not available`. Meaning: An error pop-up was dismissed and the run stopped

 Line: `done: reserved`. Meaning: You reached checkout or authorization after reserving

 Line: `power`, `quantity`, `sound`, .... Meaning: You changed a setting in the panel

 Line: `idle: reset`. Meaning: The reset button was used

Troubleshooting

The panel does not appear. Make sure Tampermonkey and TixGrab are enabled, you are on a supported domain, and refresh. Press Shift + T with the page focused (not inside a text box). The panel stays hidden on queue, login, checkout and payment pages.

Shift + click does nothing. Check that power is on, that you clicked an available seat that is not already selected, and that you are holding Shift only (no Ctrl, Alt or Command). Open the panel and look at the log: pack: 0 means no seat was recognised under the click.

It selects the wrong number of seats. Check quantity and guard. With the guard on it may take one extra seat so a single seat is not left open. Remember the cap of 8 seats, or the event's lower limit.

It stops before reserving. Look for reserve: button not found, button not ready, reserve: off, or an error line in the log. A disabled Reserve button usually means the seats were not accepted.

A pop-up was not dismissed. Make sure popups is on. TixGrab only watches for pop-ups for a short time after a grab. Pop-ups with unusual wording may not be recognised; dismiss them yourself.

No sounds. Make sure sound is true and your tab is not muted. Browsers may keep audio paused until the first click or key press on a fresh page.

Limitations

- TixGrab depends on how Ticketmaster draws its seat maps, buttons and pop-ups. If the site changes, detection can stop working.
- It can only act on seats the page exposes as selectable.
- A Reserve click is not proof of a successful reservation. Always check the site's own confirmation and checkout status.
- Colour is used to tell seat kinds apart. Seats that share a colour but are different products may be treated as one group.
- TixGrab does not guarantee any particular seat, price, quantity or outcome.

Responsible use

TixGrab is an independent project and is not affiliated with or endorsed by Ticketmaster. It stays on seat-selection pages, respects ticket limits, and does not bypass queues, captchas, sign-in or payment steps. Please use it responsibly, follow Ticketmaster's terms of use, ticket limits and event rules, and obey all applicable laws. Automated tools may be restricted by a website's terms, so you are responsible for how you use it.

Privacy

TixGrab makes no network requests of its own and loads no remote code. It keeps a few interface settings and a short-lived "just reserved" marker in the current tab's session storage. It interacts only with the Ticketmaster page it is running on.

Version history

- 1.1.0 Multicolour syntax-style panel; seats are now selected one by one with a tick on each; new rising chime on reaching checkout; error pop-ups are dismissed with an error sound.
- 1.0.0 First release: Shift + click seat grouping, automatic reserve, ticket-limit and single-seat handling, pop-up clearing, and the Shift + T control panel.

License Jass

Copyright (c) 2026 Jass. All rights reserved.

TixGrab is an original userscript authored and maintained by Jass.

Unless Jass gives prior written permission:

- You may install and use an unmodified copy for your own personal use.
- You may not sell, rent, sublicense, redistribute, or publicly re-upload the script or substantial portions of its source code.
- You may not remove or alter the author credit, copyright notice, or license notice.
- You may not publish modified or derivative versions as your own work.
- You may not use the script in a way that violates applicable law, a website's terms, purchase limits, or access restrictions.

No warranty: The script is provided "AS IS", without warranties or guarantees of any kind. Jass is not responsible for failed selections, missed tickets, unsuccessful reservations, account restrictions, losses, or other damages arising from use of the script, to the maximum extent permitted by applicable law.

This is a custom permission notice for TixGrab; it is not a claim that the script is licensed under MIT, GPL, Apache, or another standard open-source license.

Credits

Created by: Jass\
 • Project: TixGrab\
 • Version documented: 1.1.0

Please retain the author credit when keeping your personal copy.
