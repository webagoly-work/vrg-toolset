@echo off
:: VRG-DE.cmd - the old umbrella menu. Since 2026-10-27 (re-root phase 3.2) its
:: projects, dev tools, programs and prompt library are part of the START menu in
:: launcher\ (vrg-menu.json). The old menu: git show f058e6f:VRG-DE.cmd
call "%~dp0launcher\vrg-start.cmd" %*
