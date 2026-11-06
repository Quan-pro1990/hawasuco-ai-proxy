# Phân tích app gốc và đối chiếu với bản viết lại

File phân tích: `Save-Location-v12.7-mod-GameDVA.com.apk` (bản mod tải từ GameDVA).

| Mục | Giá trị |
|---|---|
| Tên trên Google Play | Save Location GPS |
| Package | `com.rayo.savecurrentlocation` (Rayo Innovations) |
| Phiên bản | 12.7, compileSdk 36 |
| Bảo vệ mã | Pairip (Google Play Integrity), một số hàm bị làm rối |
| Thư viện chính | Google Maps SDK + Places, Firebase (Auth UI: Google/Facebook/Email/SĐT, Analytics, Crashlytics, Dynamic Links), Play Billing, AdMob + Pangle + InMobi + Mintegral (quảng cáo), CameraX, iText (PDF), CountryCodePicker, WorkManager |

Cách phân tích: giải nén bằng `apktool` (layout, menu, chuỗi tiếng Anh/tiếng Việt, manifest) và `jadx`
(mã Java) để lấy danh sách màn hình, menu, các mục cài đặt, định dạng dữ liệu (CSV, ngày giờ, tọa độ),
luồng xử lý. **Bản viết lại không chép mã nguồn hay hình ảnh của app gốc**: toàn bộ mã Kotlin, layout,
biểu tượng (Material Icons, giấy phép Apache 2.0) và chuỗi giao diện được viết mới theo đúng cấu trúc đã phân tích.

## 1. Thành phần của app gốc

- **11 màn hình (Activity)**: Splash, Permission (giới thiệu cấp quyền), Home (khung chính + menu trái),
  ShowOnMap, ChangeLocation, Search, Camera, ImportCsv, OptimizeUsability, BannerForm (liên hệ), WebView.
- **Fragment trong Home**: HomeFragment (bản đồ), LocationsListFragment, GroupListFragment,
  ManageGeofenceFragment, AddGeofenceFragment, ExportCSVFragment, SettingsFragment.
- **3 widget** màn hình chính (Lưu + Chia sẻ, chỉ Lưu, chỉ Chia sẻ) và **ô Cài đặt nhanh** "Quick Save".
- **Vùng cảnh báo (Geofence)** + nhận sự kiện khởi động máy để đăng ký lại.
- **Dịch vụ chạy nền** chia sẻ vị trí trực tiếp (foreground service loại location).
- **Menu trái** (theo thứ tự): Vị trí hiện tại · Vị trí đã lưu · Thêm vị trí mới · Quản lý vùng cảnh báo ·
  Yêu thích · Đồng bộ dữ liệu · (quảng cáo dạng chữ) · Nhập/Xuất dữ liệu · Nâng cấp Premium · Cài đặt · Đăng xuất;
  đầu menu là khung Đăng nhập/Đăng ký, cuối menu là nút Liên hệ.

## 2. Đối chiếu từng màn hình

| App gốc (layout) | Bản viết lại | Ghi chú |
|---|---|---|
| `activity_home` + `nav_header_home` + `nav_footer_home` + `nav_menu_item` | `activity_home.xml`, `nav_menu_item.xml`, `HomeActivity.kt` | Thanh công cụ + menu trái, cùng thứ tự mục; đầu menu hiện số vị trí đã lưu thay cho khung đăng nhập |
| `fragment_home` + `detail_home_view_1` / `_utm` | `fragment_home.xml`, `detail_home_view.xml`, `HomeFragment.kt` | Bản đồ, nút tìm kiếm, tấm thông tin xanh (đang chia sẻ, độ chính xác, vĩ/kinh độ hoặc UTM, sao chép, địa chỉ), 2 nút **Lưu vị trí / Chia sẻ vị trí**, hướng dẫn lần đầu, vuốt để thu gọn |
| `menu_main` (danh sách, vị trí hiện tại, sắp xếp, sửa, kiểu bản đồ, phiên bản, bán kính, xong) | `menu_home/list/groups/add_geofence/settings.xml` | Mỗi màn hình hiện đúng các nút như app gốc |
| `dialog_save_location` + `dialog_latlng_view_1` / `_utm` | `dialog_save_location.xml`, `SaveLocationDialog.kt` | Ảnh (tối đa 3) + nút camera, vĩ/kinh độ (nhập thập phân hoặc **độ-phút-giây**, hoặc xem UTM), đổi vị trí trên bản đồ, Tên, Ngày (khi sửa), Địa chỉ, SĐT, Ghi chú, Nhóm, Hủy/Lưu |
| `fragment_image_upload_dialog`, `dialog_show_full_image`, `item_location_image` | `dialog_image_upload.xml`, `dialog_show_full_image.xml`, `ImageUploadDialog.kt`, `ImageViewerDialog.kt`, `ZoomImageView.kt` | 3 ô ảnh, chụp / chọn thư viện / xem / xoá; xem toàn màn hình, phóng to, tải về |
| `activity_camera` | `activity_camera.xml`, `CameraActivity.kt` | CameraX: chụp, đổi camera, Hủy |
| `fragment_location_list` + `list_items` + `custom_info_window` | `fragment_location_list.xml`, `list_items.xml`, `custom_info_window.xml`, `LocationsListFragment.kt` | Tab **Danh sách / Bản đồ**, tùy chọn hiển thị, tìm kiếm, chế độ sửa (chọn nhiều, chọn tất cả, xoá), thẻ vị trí (ảnh, tên, ngày, khoảng cách, yêu thích, địa chỉ, tọa độ, SĐT, ghi chú, nhóm, 5 nút: xem bản đồ, sửa, chia sẻ, sao chép, xoá), bản đồ có gom cụm + bán kính |
| `dialog_customize`, `dialog_radius`, `ltr_sort_item` | `dialog_switch_list.xml`, `dialog_radius.xml`, `item_single_choice.xml` | Tùy chọn hiển thị, bán kính + gom cụm, sắp xếp (ngày giảm/tăng, khoảng cách, tên) |
| `fragment_note_group` + `list_items_group` | `fragment_group_list.xml`, `list_items_group.xml`, `GroupListFragment.kt` | "Tất cả – N", từng nhóm có màu + số lượng, chế độ sửa (kéo sắp xếp, sửa, xoá), nút +, sắp xếp ngày/tên |
| `dialog_add_new_group`, `dialog_select_group_bottom_sheet` | `dialog_add_new_group.xml`, `dialog_select_group_bottom_sheet.xml`, `AddEditGroupSheet.kt`, `SelectGroupSheet.kt`, `ColorSeekBar.kt` | Tên nhóm + thanh chọn màu; chọn nhóm có dòng "+ Thêm nhóm mới" |
| `activity_show_on_map` + `menu_show_on_map` + `dialog_select_map` | `activity_show_on_map.xml`, `dialog_select_map.xml`, `ShowOnMapActivity.kt`, `NavApps.kt` | Ghim vị trí, khoảng cách, vẽ đường đi (nếu bật "Chỉ đường"), mở Google Maps / Waze / HERE / Sygic |
| `activity_change_location` | `activity_change_location.xml`, `ChangeLocationActivity.kt` | Kéo bản đồ dưới ghim cố định, hiện địa chỉ, hướng dẫn lần đầu |
| `activity_search` + `list_search_address_item` | `activity_search.xml`, `list_search_address_item.xml`, `SearchActivity.kt` | Ô tìm kiếm, gợi ý cách tìm, danh sách kết quả; dán được tọa độ hoặc link bản đồ |
| `dialog_map_style_chooser` | `dialog_map_style_chooser.xml` (`MapUtil.showTypeChooser`) | 4 kiểu: Bản đồ đường, Vệ tinh, Kết hợp, Địa hình |
| `fragment_manage_geofence` + `item_geofence` | `fragment_manage_geofence.xml`, `item_geofence.xml`, `ManageGeofenceFragment.kt` | Công tắc quyền vị trí nền, link "Tối ưu…", danh sách, nút + |
| `fragment_add_geofence` + `item_add_geofence` + `fragment_geofence_radius_dialog` | `fragment_add_geofence.xml`, `AddGeofenceFragment.kt` | Tìm theo tên, tick chọn (tối đa 100), chọn bán kính, Xong |
| `activity_optimize_usability` | `activity_optimize_usability.xml`, `OptimizeUsabilityActivity.kt` | Danh sách kiểm tra 3 mục + lối tắt cài đặt pin / thông báo |
| `fragment_export_csv` + `dialog_export_groupwise` + `dialog_download_share` | `fragment_export.xml`, `dialog_export_groupwise.xml`, `ExportFragment.kt`, `Exporter.kt` | Xuất GPX, KML, CSV, Nhập CSV, Chia sẻ CSV, Xuất PDF, Xuất ảnh, file CSV mẫu; chọn xuất tất cả hoặc theo nhóm |
| `activity_import_csv` | `activity_import_csv.xml`, `ImportCsvActivity.kt` | Hướng dẫn định dạng + ví dụ, Chọn file, báo lỗi từng dòng |
| `fragment_settings` (+ `dialog_customize_share`, `dialog_language`) | `fragment_settings.xml`, `SettingsFragment.kt` | Đủ các mục: độ chính xác, đơn vị, kiểu chia sẻ, định dạng ngày giờ (6 kiểu), chỉ đường, tự cập nhật GPS, chế độ lái xe, chế độ nhóm, giao diện, ngôn ngữ, nội dung khi chia sẻ, định dạng tọa độ (DD/DMS/DDM/UTM), app dẫn đường mặc định, phiên bản |
| `dialog_share_live_location` | `dialog_share_live_location.xml`, `ShareLocationSheet.kt` | 2 lựa chọn Vị trí hiện tại / Vị trí trực tiếp, tên hiển thị, thời gian 30 phút – 8 giờ |
| `dialog_live_location_status_screen`, `dialog_live_location_update_settings`, `item_live_location_update_chip` | cùng tên, `LiveStatusSheet.kt`, `LiveUpdateSettingsDialog.kt` | Thời gian còn lại, tần suất cập nhật (giây / mét), link, dừng chia sẻ |
| `dialog_feature_announcement` | `dialog_feature_announcement.xml`, `FeatureAnnouncementDialog.kt` | Giới thiệu tính năng chia sẻ trực tiếp |
| `dialog_contact_us` + `activity_banner_form` | `dialog_contact_us.xml`, `activity_contact_form.xml`, `ContactUsDialog.kt`, `ContactFormActivity.kt` | 4 chủ đề → biểu mẫu → soạn email |
| `activity_permission` | `activity_permission.xml`, `PermissionActivity.kt` | Thẻ quyền vị trí + dịch vụ định vị có trạng thái, nút Bắt đầu |
| `save_location_widget*`, `QuickSave` | `widget_save_share/save/share.xml`, `Widgets.kt`, `QuickSaveTileService.kt`, `QuickActionActivity.kt` | Lưu / chia sẻ vị trí hiện tại bằng 1 chạm |

## 3. Dữ liệu và định dạng (giữ tương thích)

- Mỗi vị trí: tên, vĩ độ, kinh độ, địa chỉ, SĐT, ghi chú, ngày, nhóm, yêu thích, vùng cảnh báo, tối đa 3 ảnh.
- Nhóm: tên + màu + thứ tự.
- **CSV** cùng cột như app gốc: `location name, latitude, longitude, address, contact number, note, date, group name`
  → file CSV xuất từ app gốc nhập được vào bản mới và ngược lại. Nhận cả CSV dấu chấm phẩy (Excel tiếng Việt).
- 6 định dạng ngày giờ giống hệt app gốc; 4 định dạng tọa độ DD / DMS / DDM / UTM (đã kiểm tra UTM khớp thư viện pyproj).

## 4. Khác biệt có chủ ý

| App gốc | Bản viết lại | Lý do |
|---|---|---|
| Google Maps SDK | OpenStreetMap (osmdroid), vẫn đủ 4 kiểu bản đồ (vệ tinh: Esri, địa hình: OpenTopoMap) | Google Maps cần khoá API trả phí |
| Tìm địa điểm bằng Places API (app gốc đã phải tắt vì tốn phí) | Geocoder của Android | Miễn phí, không cần khoá |
| Vẽ đường đi bằng Google Directions | Máy chủ OSRM công cộng | Miễn phí, không cần khoá |
| Đăng nhập (Google/Facebook/Email/SĐT) + đồng bộ lên máy chủ của hãng | **Sao lưu & khôi phục** ra file `.zip` (lưu Google Drive, máy tính…) | Không dùng máy chủ của hãng |
| Chia sẻ trực tiếp qua máy chủ của hãng | Máy chủ tự cài (`server/`, Node.js, không cần thư viện) | Như trên |
| Quảng cáo, Premium, giới hạn số vị trí, khoá tính năng xuất, kiểm tra USB debugging, ép cập nhật, đánh giá app | **Bỏ** – mọi tính năng mở sẵn | Ứng dụng nội bộ |
| "Yêu cầu xoá dữ liệu" (tài khoản) | "Xoá toàn bộ dữ liệu" trên máy | Không có tài khoản |
| Tên "Save Location", biểu tượng của hãng, ~40 ngôn ngữ | Tên "Lưu Vị Trí" / "Location Saver", biểu tượng riêng, tiếng Việt + tiếng Anh | Không dùng thương hiệu của người khác |
