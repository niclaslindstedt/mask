# Keep your projects in a folder

By default Mask keeps your projects in this browser's own storage for this
site. That is fast and always there, but it is also invisible and fragile:
clearing your browsing data takes it with it, another browser on the same
machine sees nothing, and there is no file you can point a backup at.

Settings → **Storage** offers a second place, still entirely on your own
machine — a folder you pick. Press **Choose a folder…**, pick one, and the
browser asks your permission for that folder and nothing else. From then on
each workspace is a plain JSON file inside it: `mask.json` for the default
workspace, `mask-<workspace>.json` for the others. Open one in an editor, diff
it, copy it to a USB stick, put the folder under version control, or let
whatever already backs up that folder back up your projects too.

It is not a cloud, and it is not sync. Nothing is uploaded, no account is
involved, and no third party can see the folder — the browser hands the app a
handle to one directory on this disk, and that is the whole mechanism. If the
folder happens to sit inside something you sync yourself, that is your
arrangement, not the app's.

A copy of the document also stays in the browser. It means the app opens
instantly rather than waiting on the disk, and that a folder which cannot be
reached — an unmounted drive, a permission the browser has dropped — costs you
nothing: Mask keeps working from the copy and shows **Reconnect the folder**
until you re-grant it. Choosing **On this device** again leaves the folder's
files exactly where they are.

The one question the app will ask is at the moment you connect. If the folder
you picked already holds projects and this device does too, neither can quietly
win, so Mask shows both counts and lets you say which set to keep. Cancel
leaves both untouched. After that first choice, the folder is the storage:
starting Mask reads it and takes whatever it holds, so a folder you carry
between browsers on the same machine carries your projects with it.

The folder option needs the browser's File System Access API, which today means
a Chromium-based browser — Chrome, Edge, Brave, Opera, Arc. In Firefox and
Safari the option is hidden and your projects stay in the browser.
