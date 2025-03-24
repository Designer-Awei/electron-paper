!macro customInit
  ; 检查旧版本并删除
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{9B1F1249-E7E3-5630-9629-D2B1DD708A3B}" "UninstallString"
  ${If} $R0 != ""
    MessageBox MB_OKCANCEL|MB_ICONINFORMATION "检测到旧版本，是否卸载？" IDOK uninst
    Abort
    uninst:
    ClearErrors
    ExecWait '$R0'
  ${EndIf}
  
  ; 检查%LOCALAPPDATA%\ElectronPaper并删除
  StrCpy $R1 "$LOCALAPPDATA\ElectronPaper"
  ${If} ${FileExists} "$R1"
    MessageBox MB_OKCANCEL|MB_ICONINFORMATION "需要删除旧版本数据：$R1。是否删除？" IDOK delData
    Abort
    delData:
    RMDir /r "$R1"
  ${EndIf}
!macroend 