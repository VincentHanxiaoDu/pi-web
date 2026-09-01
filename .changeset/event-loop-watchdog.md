---
"pi-web": patch
---

The web/API process watches its own event loop and restarts under launchd
instead of hanging.

A single blocked filesystem operation (one stalled directory open) parks all
four libuv threadpool workers; every async fs and DNS call then queues forever
while the event loop idles. The process stays alive and listening — the TCP
handshake completes from the kernel backlog — but no request is ever answered,
and KeepAlive sees a healthy pid it has no reason to restart. Observed live on
8504: the page stopped responding for minutes until a manual restart.

Two halves, both behind this change: a heartbeat watchdog exits the process
when the loop stalls past a 60-second budget (launchd restarts it), and
managed services install with `UV_THREADPOOL_SIZE=16`, so one stalled
operation is a slowdown instead of an outage. The waiting slot also caps
itself at a hard 760px on very tall displays, where 60vh alone grew a
question past one glance.
