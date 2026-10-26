; Bộ cài "Chỉnh ảnh AI" — tạo bằng NSIS 3 (https://nsis.sourceforge.io):  makensis ChinhAnhAI.nsi
; Cài cho người dùng hiện tại vào %LOCALAPPDATA%\Programs\ChinhAnhAI, không cần quyền Administrator.
; Cần có sẵn: ..\ChinhAnhAI.exe, ..\GIAY_PHEP_BEN_THU_BA.txt, ..\PhatHanh\HUONG_DAN.pdf, ChaoMung.bmp (hình trang chào)

Unicode true
!ifdef AMD64
  Target amd64-unicode
!endif

!define TEN "Chỉnh ảnh AI"
!define MA "ChinhAnhAI"
!ifdef PHIEN_BAN_RA
  !define PHIEN_BAN "${PHIEN_BAN_RA}"
!else
  !define PHIEN_BAN "1.0.0"
!endif
!define KHOA_GO "Software\Microsoft\Windows\CurrentVersion\Uninstall\${MA}"
!define KHOA_MENU "Software\Classes\SystemFileAssociations\image\shell\${MA}"
!define KHOA_MO_BANG "Software\Classes\Applications\${MA}.exe"

Name "${TEN}"
!ifndef TEP_RA
  !define TEP_RA "..\PhatHanh\${MA}-${PHIEN_BAN}-CaiDat.exe"
!endif
OutFile "${TEP_RA}"
InstallDir "$LOCALAPPDATA\Programs\${MA}"
InstallDirRegKey HKCU "Software\${MA}" "ThuMuc"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "${TEN} ${PHIEN_BAN}"
ShowInstDetails show

VIProductVersion "${PHIEN_BAN}.0"
VIAddVersionKey "ProductName" "${TEN}"
VIAddVersionKey "FileDescription" "Bộ cài ${TEN}"
VIAddVersionKey "FileVersion" "${PHIEN_BAN}"
VIAddVersionKey "ProductVersion" "${PHIEN_BAN}"
VIAddVersionKey "LegalCopyright" ""

!include "MUI2.nsh"
!include "LogicLib.nsh"

!define MUI_ICON "..\src\app.ico"
!define MUI_UNICON "..\src\app.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "ChaoMung.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "ChaoMung.bmp"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Cài đặt ${TEN} ${PHIEN_BAN}"
!define MUI_WELCOMEPAGE_TEXT "Phần mềm chỉnh ảnh tự động bằng AI: mở ảnh là tự chỉnh, bấm Lưu là xong.$\r$\n$\r$\nPhần mềm được cài cho tài khoản Windows này, không cần quyền quản trị (Administrator).$\r$\n$\r$\nNếu Chỉnh ảnh AI đang mở, hãy đóng lại trước khi cài.$\r$\n$\r$\nBấm Tiến để tiếp tục."
!define MUI_COMPONENTSPAGE_SMALLDESC
!define MUI_FINISHPAGE_TITLE "Đã cài xong ${TEN}"
!define MUI_FINISHPAGE_TEXT "Mở phần mềm từ biểu tượng ${TEN} trên màn hình hoặc menu Start.$\r$\n$\r$\nMẹo: chuột phải một ảnh trong thư mục → Chỉnh bằng ${TEN}."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${MA}.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Mở ${TEN} ngay"
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\HUONG_DAN.pdf"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Xem hướng dẫn sử dụng"
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Vietnamese"

Function .onInit
  ; .NET Framework 4.5 trở lên (Windows 10 / 11 đều có sẵn 4.8)
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" "Release"
  ${If} $0 < 378389
    MessageBox MB_YESNO|MB_ICONEXCLAMATION "${TEN} cần .NET Framework 4.8 (Windows 10 / 11 đã có sẵn).$\r$\n$\r$\nMở trang tải .NET Framework 4.8 của Microsoft?" /SD IDNO IDNO khong_tai
      ExecShell "open" "https://dotnet.microsoft.com/download/dotnet-framework/net48"
    khong_tai:
    Abort
  ${EndIf}
FunctionEnd

Section "-${TEN}" SecChinh
  SectionIn RO
  SetOutPath "$INSTDIR"
  File "..\${MA}.exe"
  File "..\GIAY_PHEP_BEN_THU_BA.txt"
  File "..\PhatHanh\HUONG_DAN.pdf"
  WriteUninstaller "$INSTDIR\GoCaiDat.exe"

  CreateDirectory "$SMPROGRAMS\${TEN}"
  CreateShortcut "$SMPROGRAMS\${TEN}\${TEN}.lnk" "$INSTDIR\${MA}.exe" "" "$INSTDIR\${MA}.exe" 0 SW_SHOWNORMAL "" "Chỉnh ảnh tự động bằng AI"
  CreateShortcut "$SMPROGRAMS\${TEN}\Hướng dẫn sử dụng.lnk" "$INSTDIR\HUONG_DAN.pdf"
  CreateShortcut "$SMPROGRAMS\${TEN}\Gỡ ${TEN}.lnk" "$INSTDIR\GoCaiDat.exe"

  ; "Mở bằng" (Open with) cho các loại ảnh hỗ trợ
  WriteRegStr HKCU "${KHOA_MO_BANG}" "FriendlyAppName" "${TEN}"
  WriteRegStr HKCU "${KHOA_MO_BANG}\DefaultIcon" "" "$INSTDIR\${MA}.exe,0"
  WriteRegStr HKCU "${KHOA_MO_BANG}\shell\open\command" "" '"$INSTDIR\${MA}.exe" "%1"'
  WriteRegStr HKCU "${KHOA_MO_BANG}\SupportedTypes" ".jpg" ""
  WriteRegStr HKCU "${KHOA_MO_BANG}\SupportedTypes" ".jpeg" ""
  WriteRegStr HKCU "${KHOA_MO_BANG}\SupportedTypes" ".png" ""
  WriteRegStr HKCU "${KHOA_MO_BANG}\SupportedTypes" ".bmp" ""
  WriteRegStr HKCU "${KHOA_MO_BANG}\SupportedTypes" ".tif" ""
  WriteRegStr HKCU "${KHOA_MO_BANG}\SupportedTypes" ".tiff" ""
  WriteRegStr HKCU "${KHOA_MO_BANG}\SupportedTypes" ".gif" ""

  ; Gỡ cài đặt trong Settings → Apps
  WriteRegStr HKCU "Software\${MA}" "ThuMuc" "$INSTDIR"
  WriteRegStr HKCU "${KHOA_GO}" "DisplayName" "${TEN}"
  WriteRegStr HKCU "${KHOA_GO}" "DisplayVersion" "${PHIEN_BAN}"
  WriteRegStr HKCU "${KHOA_GO}" "DisplayIcon" "$INSTDIR\${MA}.exe,0"
  WriteRegStr HKCU "${KHOA_GO}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${KHOA_GO}" "UninstallString" '"$INSTDIR\GoCaiDat.exe"'
  WriteRegStr HKCU "${KHOA_GO}" "QuietUninstallString" '"$INSTDIR\GoCaiDat.exe" /S'
  WriteRegDWORD HKCU "${KHOA_GO}" "NoModify" 1
  WriteRegDWORD HKCU "${KHOA_GO}" "NoRepair" 1
  WriteRegDWORD HKCU "${KHOA_GO}" "EstimatedSize" 2600
SectionEnd

Section "Lối tắt trên màn hình (Desktop)" SecManHinh
  CreateShortcut "$DESKTOP\${TEN}.lnk" "$INSTDIR\${MA}.exe" "" "$INSTDIR\${MA}.exe" 0 SW_SHOWNORMAL "" "Chỉnh ảnh tự động bằng AI"
SectionEnd

Section "Menu chuột phải: Chỉnh bằng ${TEN}" SecMenu
  ; hiện khi chọn 1 ảnh bất kỳ (jpg, png…); nhiều ảnh thì dùng Gửi tới
  WriteRegStr HKCU "${KHOA_MENU}" "" "Chỉnh bằng ${TEN}"
  WriteRegStr HKCU "${KHOA_MENU}" "Icon" "$INSTDIR\${MA}.exe,0"
  WriteRegStr HKCU "${KHOA_MENU}" "MultiSelectModel" "Single"
  WriteRegStr HKCU "${KHOA_MENU}\command" "" '"$INSTDIR\${MA}.exe" "%1"'
SectionEnd

Section "Gửi tới (Send to): chỉnh nhiều ảnh một lúc" SecGuiToi
  CreateShortcut "$SENDTO\${TEN}.lnk" "$INSTDIR\${MA}.exe" "" "$INSTDIR\${MA}.exe" 0
SectionEnd

Section "-KetThuc"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'   ; Explorer cập nhật menu, biểu tượng
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecManHinh} "Biểu tượng ${TEN} trên màn hình."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecMenu} "Chuột phải một ảnh trong thư mục → Chỉnh bằng ${TEN}."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecGuiToi} "Chọn nhiều ảnh → chuột phải → Gửi tới → ${TEN} để chỉnh hàng loạt."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  Delete "$INSTDIR\${MA}.exe"
  Delete "$INSTDIR\GIAY_PHEP_BEN_THU_BA.txt"
  Delete "$INSTDIR\HUONG_DAN.pdf"
  Delete "$INSTDIR\GoCaiDat.exe"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\${TEN}.lnk"
  Delete "$SENDTO\${TEN}.lnk"
  Delete "$SMPROGRAMS\${TEN}\${TEN}.lnk"
  Delete "$SMPROGRAMS\${TEN}\Hướng dẫn sử dụng.lnk"
  Delete "$SMPROGRAMS\${TEN}\Gỡ ${TEN}.lnk"
  RMDir "$SMPROGRAMS\${TEN}"
  DeleteRegKey HKCU "${KHOA_MENU}"
  DeleteRegKey HKCU "${KHOA_MO_BANG}"
  DeleteRegKey HKCU "${KHOA_GO}"
  DeleteRegKey HKCU "Software\${MA}"
  ; cài đặt người dùng (API key, thư mục lưu…) ở %APPDATA%\ChinhAnhAI: hỏi trước khi xoá; ảnh đã chỉnh không bao giờ bị xoá
  IfFileExists "$APPDATA\${MA}\*.*" 0 xong
    MessageBox MB_YESNO|MB_ICONQUESTION "Xoá luôn cài đặt của ${TEN} (API key, thư mục lưu…)?$\r$\nẢnh bạn đã chỉnh không bị xoá." /SD IDNO IDNO xong
    RMDir /r "$APPDATA\${MA}"
  xong:
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
SectionEnd
