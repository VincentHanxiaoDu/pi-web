---
"pi-web": patch
---

Quick switcher picks now move the browser to another project's workspace.

The switcher lists sessions from every project, but choosing one resolved its
workspace against the selected project's workspaces alone. A pick from another
project failed that resolution and left the workspace, project, goal panel and
URL describing the previous project — the goal panel showed the other
project's goal with live Pause and Abandon buttons, and a refresh could not
find the session you had just picked. Ancestry now resolves against a full
workspace catalogue, and a goal panel whose selected session's directory sits
outside the selected workspace reads as unloaded instead of borrowing that
workspace's records.
