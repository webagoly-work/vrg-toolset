# Run once every Claude session that used the old H:\VRG\Full\notes\stack has ended (its MCP servers hold the folder).
# Replaces the old copy with a junction to this folder, so old paths keep working. The old copy is kept as stack.old.
$old = 'H:\VRG\Full\notes\stack'; $new = 'H:\VRG\Full\Planner_VRG_U100\Stack'
if ((Get-Item $old).Attributes -band [IO.FileAttributes]::ReparsePoint) { 'already a link'; exit 0 }
Rename-Item $old 'stack.old' -ErrorAction Stop
cmd /c mklink /J $old $new
