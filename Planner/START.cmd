@echo off
:: ==========================================================================
::  START.cmd - the old front door, kept so every shortcut, the Kapu and the
::  CYD KEZDOLAP button keep working.
::
::  2026-10-27 - re-root phase 3.2: the menu moved to ..\launcher (vrg-ui.ps1 +
::  vrg-menu.json, the one registry for tools, projects, local servers and
::  programs). Tool keys 1-9, 0, K are unchanged; the Planner / Inventory / Vendor
::  actions are in the P / I / V submenus, the local servers under O.
::  To add or move a tool: edit launcher\vrg-menu.json, then run
::  node tools\check-start.js. The old menu is in git history:
::  git show f058e6f:Planner/START.cmd
:: ==========================================================================
call "%~dp0..\launcher\vrg-start.cmd" %*
