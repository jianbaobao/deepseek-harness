; DeepSeek Harness Windows installer (Inno Setup).
; Build: ISCC.exe /DMyAppVersion=<version> scripts/installer-windows.iss
; Source tree expected at dist/windows-bundle/ (portable dir with bundled node/).
#ifndef MyAppVersion
  #define MyAppVersion "0.0.0"
#endif
#define MyAppName "DeepSeek Harness"
#define MyAppExeName "dsh.cmd"
#ifndef MyAppVersionInfo
  #define MyAppVersionInfo "0.0.0.0"
#endif

[Setup]
AppId={{8F1B2C3D-4E5F-4A6B-9C7D-1D2E3F4A5B6C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=DeepSeek Harness
DefaultDirName={autopf}\DeepSeek Harness
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=DeepSeek-Harness-{#MyAppVersion}-setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\node\node.exe
VersionInfoVersion={#MyAppVersionInfo}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\dist\windows-bundle\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

[Icons]
Name: "{group}\DSH Command Prompt"; Filename: "{cmd}"; Parameters: "/k ""{app}\{#MyAppExeName}"""
Name: "{autodesktop}\DeepSeek Harness"; Filename: "{cmd}"; Parameters: "/k ""{app}\{#MyAppExeName}"""; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "Path"; \
  ValueData: "{olddata};{app}"; Check: NeedsAddPath

[Code]
function NeedsAddPath(): Boolean;
var
  OrigPath: string;
begin
  if not RegQueryStringValue(HKEY_CURRENT_USER, 'Environment', 'Path', OrigPath) then
  begin
    Result := True;
    Exit;
  end;
  Result := Pos(LowerCase('{app}'), LowerCase(OrigPath)) = 0;
end;
