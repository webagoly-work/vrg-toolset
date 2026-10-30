@echo off
:: vrg-start.cmd - starts the START menu. Planner\START.cmd and VRG-DE.cmd forward here; this forwards to
:: vrg-launch.cmd, which picks the portable Windows Terminal or this console.
call "%~dp0vrg-launch.cmd" start %*
