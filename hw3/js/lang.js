/* js/lang.js - 多語言切換邏輯 (整理修正版) */

/* js/lang.js - i18n (ZH/EN) - stable version
   - scans: [data-i18n], [data-i18n-placeholder]
   - provides: window.getTrans, window.applyI18n, window.setLang, window.getLang
   - dispatches: document event "langChanged" when language updates
*/


// ---------------------------
// 1) translations
// ---------------------------
const translations = {
  zh: {
    // ===== Page Titles =====
    page_title_login: "登入 - 校園資源預約系統",
    page_title_register: "註冊 - 校園資源預約系統",
    page_title_index: "首頁 - 校園資源預約系統",
    page_title_user: "使用者頁面 - 校園資源預約系統",
    page_title_admin: "管理者介面 - 校園資源預約系統",

    // ===== Common / Auth =====
    back_home: "← 返回首頁",
    btn_back_home: "回到主頁",

    login_title: "會員登入",
    register_title: "建立新帳號",

    label_username: "用戶名稱",
    label_email: "電子郵件 (帳號)",
    label_password: "密碼",
    label_reg_password: "設定密碼",
    label_confirm_password: "確認密碼",
    label_photo: "上傳大頭貼",

    btn_login: "登入",
    btn_register: "註冊帳號",
    btn_login_register: "登入/註冊",
    btn_logout: "登出",

    link_no_account: '還沒有帳號？ <a href="register.html">立即註冊</a>',
    link_has_account: '已有帳號？ <a href="login.html">直接登入</a>',

    placeholder_username: "設定您的顯示名稱",
    placeholder_email: "請輸入 Email",
    placeholder_password: "請輸入密碼",

    toggle_show: "顯示",
    toggle_hide: "隱藏",
    hint_photo: "支援格式：JPG, JPEG, PNG, GIF",
    btn_choose_file: "選擇檔案",

    // ===== Index (Home) =====
    index_brand_title: "Campus Reservation",
    index_brand_subtitle: "校園設備 / 空間預約系統",

    nav_home: "🏠 主頁",
    nav_user: "👤 使用者頁面",
    nav_admin: "🛠 管理者介面",
    avatar_title: "使用者頭貼",

    // ===== Index Banners =====
    index_hero_title: "快速查詢可用資源，立即完成預約",
    index_hero_desc_1: "以<strong>分類</strong>、<strong>時段</strong>、<strong>是否已預約</strong>與<strong>關鍵字</strong>篩選資源。<br>系統會依你選擇的時段顯示「可預約 / 已預約 / 使用中 / 停用」等狀態。",
    index_time: "⏰ 週一～週五 08:00–18:00",

    filter_category: "分類搜尋",
    filter_date: "日期",
    filter_start: "開始時間",
    filter_end: "結束時間",
    filter_reserved: "是否預約",
    filter_keyword: "關鍵字搜尋（名稱 / 地點 / 描述）",
    ph_keyword: "例如：投影機、會議室、圖書館...",

    cat_all: "全部分類",
    cat_space: "空間類",
    cat_3c: "3C 類",
    cat_book: "書本類",

    reserved_all: "全部",
    reserved_available: "未預約（可用）",
    reserved_reserved: "已預約（未開始）",
    reserved_inuse: "使用中",

    btn_reset: "清除條件",
    btn_apply: "套用搜尋",

    results_title: "資源展示（由新到舊）",
    results_hint: "已依條件顯示資源狀態。",

    empty_no_resource: "沒有符合條件的資源",
    label_location: "地點",
    label_category: "分類",
    label_status: "狀態",

    btn_reserve: "預約",
    btn_info: "查看資訊",

    // ===== Modal (Reserve) =====
    modal_title: "預約資源",
    btn_close: "關閉",
    modal_resource: "資源",
    modal_type: "分類",
    modal_start: "開始時間",
    modal_end: "結束時間",
    btn_cancel: "取消",
    btn_confirm_reserve: "確認預約",
    msg_submitting: "送出預約中...",

    modal_type_space: "space（空間）",
    modal_type_equipment: "equipment（設備）",

    // ===== Types / Status =====
    type_space: "空間",
    type_equipment: "設備",
    type_other: "其他",

    status_maintenance: "維護中",
    status_inactive: "停用",
    status_unavailable: "不可用",
    status_available: "可預約",
    status_reserved_in_range: "該時段已被預約",
    reserved_inuse: "使用中",

    // ===== Errors =====
    error_required: "請輸入帳號 (Email) 與密碼",
    error_all_required: "錯誤：必填欄位不可為空",
    error_mismatch: "錯誤：確認密碼與設定密碼不相符",
    text_no_file: "未選擇任何檔案(此欄位非必填)",
    error_photo_type: "錯誤：僅支援 JPG, PNG, GIF 格式的圖片",
    error_email_exists: "錯誤：相同帳號已經被建立過",
    error_password_format: "錯誤：密碼格式不符合規定（至少 8 碼，且需包含英文字母與數字）",
    error_photo_too_large: "錯誤：圖片檔案太大（上限 2MB）",
    error_upload_failed: "錯誤：圖片上傳失敗，請稍後再試",
    error_server: "系統錯誤，請稍後再試",
    error_email_format: "錯誤：電子郵件格式不正確",

    // ===== Confirm / Toast =====
    confirm_logout: "是否確認要登出？",
    toast_logged_out_title: "已登出",
    toast_logged_out_msg: "你已成功登出。",

    toast_need_login_title: "需要登入",
    toast_need_login_userpage: "請先登入後再前往使用者頁面。",
    toast_need_login_reserve: "請先登入後再進行預約。",

    toast_hint_title: "提示",
    toast_resource_info_title: "資源資訊",
    toast_cannot_reserve_title: "無法預約",
    toast_cannot_reserve_msg: "此資源在所選時段不可預約，請更換時段或資源。",

    toast_time_error_title: "時間錯誤",
    toast_time_error_msg: "請確認開始/結束時間。",

    toast_reserved_title: "預約成功",
    toast_reserved_msg_prefix: "已預約：",

    // ===== Booking errors map =====
    err_time_conflict: "此時段已被預約",
    err_not_in_open_hours: "不在可預約的開放時間",
    err_resource_unavailable: "此資源目前不可預約",
    err_invalid_time_range: "時間區間不正確",
    err_not_logged_in: "請先登入再預約",
    err_session_expired: "登入已逾時，請重新登入",
    err_server_error: "系統錯誤，請稍後再試",
    err_unknown: "預約失敗，請稍後再試",
    err_resource_closed: "此資源在所選日期/時間不開放",
    err_cross_day: "不允許跨日預約，請選同一天",

    // ===== User Page =====
    user_account_title: "帳戶資訊",
    user_account_edit: "編輯帳戶資訊",
    user_name: "名稱",
    user_email: "帳號（Email）",
    user_role: "角色",
    user_avatar: "頭貼（上傳圖片）",
    user_account_hint: "可於此查看帳戶資訊；點擊「編輯帳戶資訊」可修改名稱、帳號、頭貼。",

    edit_title: "編輯帳戶資訊",
    edit_avatar_hint: "支援格式：JPG, JPEG, PNG, GIF",
    edit_save: "儲存",
    edit_cancel: "取消",

    pwd_title: "密碼變更",
    pwd_subtitle: "舊密碼驗證正確，且新密碼與確認一致，才可修改",
    pwd_old: "舊密碼",
    pwd_new: "新密碼",
    pwd_confirm: "新密碼確認",
    pwd_submit: "變更密碼",

    resv_title: "我的預約",
    resv_subtitle: "僅顯示該使用者的預約；可查看細節；可取消「自己的且未開始」的預約；取消後狀態更新為 cancelled 並紀錄取消理由",
    resv_tab_all: "全部",
    resv_tab_upcoming: "已預約",
    resv_tab_cancelled: "已取消",
    resv_tab_completed: "已完成",
    resv_refresh: "重新整理",
    resv_details: "查看細節",
    resv_cancel: "取消預約",
    resv_empty: "目前沒有符合條件的預約。",
    resv_cancel_block: "此預約已開始/已結束，無法取消。",

    resv_status_booked: "已預約",
    resv_status_cancelled: "已取消",
    resv_status_completed: "已完成",

    detail_title: "預約細節",
    detail_close: "關閉",

    cancel_title: "取消預約",
    cancel_reason: "取消理由",
    cancel_reason_ph: "請輸入取消理由（必填）",
    cancel_confirm: "確認取消",
    cancel_back: "返回",
    cancel_reason_auto: "未在預約時間內完成",

    del_title: "刪除帳號",
    del_subtitle: "刪除會釋放所有未使用資源，並刪除 user 資料",
    del_desc: "此操作無法復原。刪除前請確認你已了解影響。",
    del_check: "我已了解並同意刪除帳號",
    del_btn: "刪除帳號",

    del_confirm_title: "確認刪除帳號",
    del_confirm_desc: "刪除後將釋放所有預約並移除使用者資料，是否繼續？",
    del_confirm_yes: "確認刪除",
    del_confirm_no: "取消",
    del_confirm_final: "此操作無法復原，確定要刪除帳號？",
    del_failed: "刪除失敗，請稍後再試",
    del_ok_title: "已刪除",
    del_ok_msg: "帳號已刪除，將返回主頁。",

    err_required: "此欄位必填",
    err_email: "Email 格式不正確",
    err_wrong_old_pwd: "舊密碼不正確",
    ok_profile: "更新成功",
    ok_pwd: "已更新密碼",
    ok_cancel: "已取消",
    ok_delete: "帳號已刪除、資源釋放、已登出",

    // ===== Admin Page =====
    admin_account_title: "帳戶資訊",
    admin_pwd_title: "修改密碼",
    admin_delete_title: "刪除帳戶",

    admin_bookings_title: "所有預約管理",
    admin_bookings_subtitle: "可查看所有使用者預約（Who / What / When），可標記完成或刪除（前端示範）",
    admin_resources_title: "所有資源管理",
    admin_resources_subtitle: "可新增 / 編輯 / 刪除資源（前端示範）",

    // Admin table headers (建議你用在表格 th 上)
    admin_th_who: "使用者",
    admin_th_what: "資源",
    admin_th_when: "時間",
    admin_th_status: "狀態",
    admin_th_actions: "操作",
    admin_btn_mark_completed: "標記完成",
    admin_btn_delete_booking: "刪除預約",
    admin_btn_add_resource: "新增資源",
    admin_btn_edit: "編輯",
    admin_btn_delete: "刪除",
    admin_all: "全部",
    admin_all_types: "全部類型",
    admin_all_status: "全部狀態",
    admin_booking_search_ph: "搜尋：使用者 / 資源 / 地點 / ID",
    admin_resource_search_ph: "搜尋：資源名稱 / 地點 / 類型",
    admin_status_active: "啟用",
    admin_status_inactive: "停用",
    admin_status_maintenance: "維護",
    admin_filter_all_types: "全部類型",
    admin_filter_all_status: "全部狀態",
    // ===== Admin Resources extra i18n =====
    /* zh */
    admin_res_empty: "沒有資源",
    admin_res_disable: "停用",
    admin_res_enable: "啟用",
    admin_res_delete_confirm: "確定要刪除（停用）此資源嗎？系統會先取消所有已預約的預約。",
    admin_res_delete_done_prefix: "完成，已取消預約數：",
    admin_res_time_err: "開放結束時間必須晚於開始時間。",

    admin_res_modal_title: "資源",
    admin_res_name: "資源名稱",
    admin_res_name_ph: "例如：會議室 A / 投影機 Epson EB-X41",
    admin_res_type: "類型",
    admin_res_category: "分類",
    admin_res_category_ph: "例如：3C / space",
    admin_res_location: "地點",
    admin_res_location_ph: "例如：行政大樓 2F",
    admin_res_desc: "描述",
    admin_res_desc_ph: "可留空",
    admin_res_status: "狀態",
    admin_res_status_active: "active",
    admin_res_status_inactive: "inactive",
    admin_res_status_maintenance: "maintenance",
    admin_res_open_days: "開放日",
    admin_res_open_days_hint: "預設：週一到週五",
    admin_res_open_time: "開放時間",

    admin_filter_all_type: "全部類型",
    admin_filter_all_status: "全部狀態",
    admin_filter_kw_res: "搜尋：資源名稱 / 地點 / 類型 / ID",
    opt_all_types: "全部類型",
    opt_all_status: "全部狀態",
    opt_equipment: "設備",
    opt_space: "空間",
    opt_status_active: "可用（active）",
    opt_status_inactive: "停用（inactive）",
    opt_status_maintenance: "維護（maintenance）",
    wd_mon: "週一",
    wd_tue: "週二",
    wd_wed: "週三",
    wd_thu: "週四",
    wd_fri: "週五",
    wd_sat: "週六",
    wd_sun: "週日",

    admin_res_modal_title: "編輯資源",
    admin_res_name: "資源名稱",
    admin_res_type: "類型",
    admin_res_category: "分類",
    admin_res_location: "地點",
    admin_res_desc: "描述",
    admin_res_status: "狀態",
    admin_res_open_days: "開放星期",
    admin_res_open_days_hint: "勾選資源可開放借用/預約的星期。",
    admin_res_open_start: "開始時間",
    admin_res_open_end: "結束時間",

    admin_res_update_ok: "已更新",
    admin_res_delete_confirm: "確定要刪除此資源嗎？（會改為停用/刪除，並取消未開始預約）",
  },

  en: {
    // ===== Page Titles =====
    page_title_login: "Login - Campus Reservation System",
    page_title_register: "Register - Campus Reservation System",
    page_title_index: "Home - Campus Reservation System",
    page_title_user: "User Page - Campus Reservation System",
    page_title_admin: "Admin Panel - Campus Reservation System",

    // ===== Common / Auth =====
    back_home: "← Back to Home",
    btn_back_home: "Back to Home",

    login_title: "Member Login",
    register_title: "Create Account",

    label_username: "Username",
    label_email: "Email Address",
    label_password: "Password",
    label_reg_password: "Set Password",
    label_confirm_password: "Confirm Password",
    label_photo: "Upload Avatar",

    btn_login: "Sign In",
    btn_register: "Sign Up",
    btn_login_register: "Login / Register",
    btn_logout: "Logout",

    link_no_account: 'No account? <a href="register.html">Register now</a>',
    link_has_account: 'Have an account? <a href="login.html">Login here</a>',

    placeholder_username: "Set your display name",
    placeholder_email: "Enter your email",
    placeholder_password: "Enter your password",

    toggle_show: "Show",
    toggle_hide: "Hide",
    hint_photo: "Supported: JPG, JPEG, PNG, GIF",
    btn_choose_file: "Choose File",

    // ===== Index (Home) =====
    index_brand_title: "Campus Reservation",
    index_brand_subtitle: "Campus Equipment / Space Reservation",

    nav_home: "🏠 Home",
    nav_user: "👤 User Page",
    nav_admin: "🛠 Admin Panel",
    avatar_title: "User avatar",

    // ===== Index Banners =====
    index_hero_title: "Quickly Search and Reserve Resources",
    index_hero_desc_1: "Filter by <strong>Category</strong>, <strong>Time</strong>, <strong>Reservation Status</strong>, and <strong>Keyword</strong>.<br>The system will show the status (Available / Reserved / In Use / Disabled) based on your selected time.",
    index_time: "⏰ Mon–Fri 08:00–18:00",

    filter_category: "Category",
    filter_date: "Date",
    filter_start: "Start Time",
    filter_end: "End Time",
    filter_reserved: "Reservation Status",
    filter_keyword: "Keyword (name / location / description)",
    ph_keyword: "e.g., projector, meeting room, library...",

    cat_all: "All",
    cat_space: "Spaces",
    cat_3c: "3C Devices",
    cat_book: "Books",

    reserved_all: "All",
    reserved_available: "Available (not reserved)",
    reserved_reserved: "Reserved (not started)",
    reserved_inuse: "In use",

    btn_reset: "Reset",
    btn_apply: "Apply",

    results_title: "Resources (Newest to Oldest)",
    results_hint: "Showing resource status based on filters.",

    empty_no_resource: "No resources match your filters.",
    label_location: "Location",
    label_category: "Category",
    label_status: "Status",

    btn_reserve: "Reserve",
    btn_info: "Details",

    // ===== Modal (Reserve) =====
    modal_title: "Reserve Resource",
    btn_close: "Close",
    modal_resource: "Resource",
    modal_type: "Type",
    modal_start: "Start",
    modal_end: "End",
    btn_cancel: "Cancel",
    btn_confirm_reserve: "Confirm",
    msg_submitting: "Submitting reservation...",

    modal_type_space: "space (room)",
    modal_type_equipment: "equipment (device)",

    // ===== Types / Status =====
    type_space: "Space",
    type_equipment: "Equipment",
    type_other: "Other",

    status_maintenance: "Maintenance",
    status_inactive: "Inactive",
    status_unavailable: "Unavailable",
    status_available: "Available",
    status_reserved_in_range: "Reserved in this time range",
    reserved_inuse: "In use",

    // ===== Errors =====
    error_required: "Please enter email and password",
    error_all_required: "Error: Required fields cannot be empty",
    error_mismatch: "Error: Passwords do not match",
    text_no_file: "No file chosen (optional)",
    error_photo_type: "Error: Only JPG, PNG, GIF formats are supported",
    error_email_exists: "Error: This email is already registered",
    error_password_format: "Error: Invalid password (min 8 chars, must include letters and numbers)",
    error_photo_too_large: "Error: Image file is too large (max 2MB)",
    error_upload_failed: "Error: Upload failed. Please try again later",
    error_server: "Server error. Please try again later",
    error_email_format: "Error: Invalid email format",

    // ===== Confirm / Toast =====
    confirm_logout: "Are you sure you want to log out?",
    toast_logged_out_title: "Logged out",
    toast_logged_out_msg: "You have successfully logged out.",

    toast_need_login_title: "Login required",
    toast_need_login_userpage: "Please log in before opening the user page.",
    toast_need_login_reserve: "Please log in before making a reservation.",

    toast_hint_title: "Hint",
    toast_resource_info_title: "Resource info",
    toast_cannot_reserve_title: "Cannot reserve",
    toast_cannot_reserve_msg: "This resource is not available for the selected time. Please choose another time or resource.",

    toast_time_error_title: "Time error",
    toast_time_error_msg: "Please check the start/end time.",

    toast_reserved_title: "Reserved",
    toast_reserved_msg_prefix: "Reserved: ",

    // ===== Booking errors map =====
    err_time_conflict: "This time range is already reserved",
    err_not_in_open_hours: "This time is outside the allowed booking hours",
    err_resource_unavailable: "This resource is currently unavailable",
    err_invalid_time_range: "Invalid time range",
    err_not_logged_in: "Please log in to reserve",
    err_session_expired: "Session expired. Please log in again",
    err_server_error: "Server error. Please try again later",
    err_unknown: "Reservation failed. Please try again later",
    err_resource_closed: "This resource is closed for the selected date/time",
    err_cross_day: "Cross-day booking is not allowed. Please book within the same day",

    // ===== User Page =====
    user_account_title: "Account Info",
    user_account_edit: "Edit Profile",
    user_name: "Name",
    user_email: "Email (Account)",
    user_role: "Role",
    user_avatar: "Avatar (Upload Image)",
    user_account_hint: "View your account information here. Click “Edit Profile” to update name/email/avatar.",

    edit_title: "Edit Profile",
    edit_avatar_hint: "Supported: JPG, JPEG, PNG, GIF",
    edit_save: "Save",
    edit_cancel: "Cancel",

    pwd_title: "Change Password",
    pwd_subtitle: "Old password must be correct and new password must match confirmation",
    pwd_old: "Old Password",
    pwd_new: "New Password",
    pwd_confirm: "Confirm New Password",
    pwd_submit: "Update Password",

    resv_title: "My Reservations",
    resv_subtitle: "Shows only your bookings. You can view details and cancel upcoming reservations with a reason.",
    resv_tab_all: "All",
    resv_tab_upcoming: "Booked",
    resv_tab_cancelled: "Cancelled",
    resv_tab_completed: "Completed",
    resv_refresh: "Refresh",
    resv_details: "Details",
    resv_cancel: "Cancel",
    resv_empty: "No reservations match the filter.",
    resv_cancel_block: "This reservation has started/ended and cannot be cancelled.",

    resv_status_booked: "Booked",
    resv_status_cancelled: "Cancelled",
    resv_status_completed: "Completed",

    detail_title: "Reservation Details",
    detail_close: "Close",

    cancel_title: "Cancel Reservation",
    cancel_reason: "Cancel reason",
    cancel_reason_ph: "Please enter a reason (required)",
    cancel_confirm: "Confirm Cancel",
    cancel_back: "Back",
    cancel_reason_auto: "Not completed within the reserved time",

    del_title: "Delete Account",
    del_subtitle: "Deleting will release all bookings and remove the user record",
    del_desc: "This action cannot be undone.",
    del_check: "I understand and want to delete my account",
    del_btn: "Delete Account",

    del_confirm_title: "Confirm Account Deletion",
    del_confirm_desc: "This will release all bookings and remove your data. Continue?",
    del_confirm_yes: "Delete",
    del_confirm_no: "Cancel",
    del_confirm_final: "This action cannot be undone. Are you sure you want to delete your account?",
    del_failed: "Deletion failed, please try again later",
    del_ok_title: "Deleted",
    del_ok_msg: "Account deleted, returning to home page.",

    err_required: "Required",
    err_email: "Invalid email format",
    err_wrong_old_pwd: "Incorrect old password",
    ok_profile: "Updated",
    ok_pwd: "Password updated",
    ok_cancel: "Cancelled",
    ok_delete: "Account deleted, resources released, logged out",

    // ===== Admin Page =====
    admin_account_title: "Account",
    admin_pwd_title: "Change Password",
    admin_delete_title: "Delete Account",

    admin_bookings_title: "All Bookings",
    admin_bookings_subtitle: "View all bookings (Who / What / When). Mark completed or delete (frontend demo).",
    admin_resources_title: "All Resources",
    admin_resources_subtitle: "Create / edit / delete resources (frontend demo).",

    admin_th_who: "User",
    admin_th_what: "Resource",
    admin_th_when: "Time",
    admin_th_status: "Status",
    admin_th_actions: "Actions",
    admin_btn_mark_completed: "Mark Completed",
    admin_btn_delete_booking: "Delete Booking",
    admin_btn_add_resource: "Add Resource",
    admin_btn_edit: "Edit",
    admin_btn_delete: "Delete",
    admin_all: "All",
    admin_all_types: "All Types",
    admin_all_status: "All Status",
    admin_status_active: "active",
    admin_status_inactive: "inactive",
    admin_status_maintenance: "maintenance",
    admin_booking_search_ph: "Search: user / resource / location / ID",
    admin_resource_search_ph: "Search: name / location / type",
    admin_filter_all_types: "All Types",
    admin_filter_all_status: "All status",
    /* en */
    admin_res_empty: "No resources.",
    admin_res_disable: "Disable",
    admin_res_enable: "Enable",
    admin_res_delete_confirm: "Delete (disable) this resource? All reserved bookings will be cancelled first.",
    admin_res_delete_done_prefix: "Done. Cancelled bookings: ",
    admin_res_time_err: "Open end must be after open start.",

    admin_res_modal_title: "Resource",
    admin_res_name: "Resource Name",
    admin_res_name_ph: "e.g., Meeting Room A / Epson EB-X41",
    admin_res_type: "Type",
    admin_res_category: "Category",
    admin_res_category_ph: "e.g., 3C / space",
    admin_res_location: "Location",
    admin_res_location_ph: "e.g., Building 2F",
    admin_res_desc: "Description",
    admin_res_desc_ph: "Optional",
    admin_res_status: "Status",
    admin_res_status_active: "active",
    admin_res_status_inactive: "inactive",
    admin_res_status_maintenance: "maintenance",
    admin_res_open_days: "Open Days",
    admin_res_open_days_hint: "Default: Mon–Fri",
    admin_res_open_time: "Open Time",

    admin_filter_all_type: "All",
    admin_filter_all_status: "All",
    admin_filter_kw_res: "Search: name / location / type / ID",
    opt_all_types: "All Types",
    opt_all_status: "All Status",
    opt_equipment: "Equipment",
    opt_space: "Space",
    opt_status_active: "Active",
    opt_status_inactive: "Inactive",
    opt_status_maintenance: "Maintenance",

    wd_mon: "Mon",
    wd_tue: "Tue",
    wd_wed: "Wed",
    wd_thu: "Thu",
    wd_fri: "Fri",
    wd_sat: "Sat",
    wd_sun: "Sun",

    admin_res_modal_title: "Edit Resource",
    admin_res_name: "Resource Name",
    admin_res_type: "Type",
    admin_res_category: "Category",
    admin_res_location: "Location",
    admin_res_desc: "Description",
    admin_res_status: "Status",
    admin_res_open_days: "Open Days",
    admin_res_open_days_hint: "Select days this resource is available.",
    admin_res_open_start: "Open Start",
    admin_res_open_end: "Open End",

    admin_res_update_ok: "Updated",
    admin_res_delete_confirm: "Delete this resource? (It will be soft-deleted/inactivated and upcoming bookings will be cancelled.)",

  }
};

document.addEventListener("DOMContentLoaded", function () {
  // 1) 初始化語言 (預設英文)
  const savedLang = localStorage.getItem("appLang") || "en";
  applyLanguage(savedLang);

  // 2) 綁定切換按鈕
  const langBtn = document.getElementById("lang-switch-btn");
  if (langBtn) {
    updateBtnText(langBtn, savedLang);

    langBtn.addEventListener("click", function (e) {
      e.preventDefault();
      const currentLang = localStorage.getItem("appLang") || "en";
      const newLang = currentLang === "zh" ? "en" : "zh";

      applyLanguage(newLang);
      updateBtnText(this, newLang);
    });
  }
});

function updateBtnText(btn, lang) {
  // 按鈕顯示的是「想切換過去的語言」
  btn.textContent = lang === "zh" ? "English" : "中文";
}

function applyLanguage(lang) {
  localStorage.setItem("appLang", lang);

  // 更新一般文字
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    const val = translations?.[lang]?.[key];
    if (!val) return;

    if (String(val).includes("<")) {
      element.innerHTML = val;
    } else {
      element.textContent = val;
    }
  });

  // 更新 placeholder
  document.querySelectorAll("[data-i18n-placeholder]").forEach((input) => {
    const key = input.getAttribute("data-i18n-placeholder");
    const val = translations?.[lang]?.[key];
    if (!val) return;
    input.placeholder = val;
  });

  // 更新 title 屬性
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    const val = translations?.[lang]?.[key];
    if (!val) return;
    el.title = val;
  });

  // 更新頁面標題
  let titleKey = "page_title_register";
  if (document.body.id === "page-login") titleKey = "page_title_login";
  else if (document.body.id === "page-register") titleKey = "page_title_register";
  else if (document.body.id === "page-index") titleKey = "page_title_index";
  else if (document.body.id === "page-user") titleKey = "page_title_user";
  else if (document.body.id === "page-admin") titleKey = "page_title_admin";



  const titleVal = translations?.[lang]?.[titleKey];
  if (titleVal) document.title = titleVal;

  // ✅ 通知其他頁面/JS：語言已切換（讓 index.js 重新渲染動態內容）
  document.dispatchEvent(new CustomEvent('langChanged', { detail: { lang } }));
}

// Helper: 讓 JS 也能直接取得當前翻譯
window.getTrans = function (key) {
  const lang = localStorage.getItem("appLang") || "en";
  return translations?.[lang]?.[key] || key;
};
