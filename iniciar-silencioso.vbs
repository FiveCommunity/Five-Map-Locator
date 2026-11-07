Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
rootDir = fso.GetParentFolderName(WScript.ScriptFullName)
singleExe = rootDir & "\release\Five Map Locator.exe"
unpackedExe = rootDir & "\release\win-unpacked\Five Map Locator.exe"

If fso.FileExists(singleExe) Then
    WshShell.Run """" & singleExe & """", 1, False
ElseIf fso.FileExists(unpackedExe) Then
    WshShell.Run """" & unpackedExe & """", 1, False
End If
