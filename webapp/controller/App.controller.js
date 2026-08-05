sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.App", {
        
        onInit: function () {
            // Khởi tạo ứng dụng gốc
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.attachRouteMatched(this._onGlobalRouteMatched, this);
        },

        _onGlobalRouteMatched: function (oEvent) {
            // 1. Logic ép refresh data (giữ nguyên của sếp)
            var oModel = this.getOwnerComponent().getModel();
            if (oModel) {
                oModel.refresh(true);
            }

            // ==============================================================
            // 2. MỚI: TỰ ĐỘNG HIGHLIGHT DẤU CHẤM XANH TRÊN THANH MENU BÊN TRÁI
            // ==============================================================
            var sRouteName = oEvent.getParameter("name"); // Lấy tên cái Route (trang) vừa nhảy tới (vd: "dispute")
            
            // LƯU Ý: Chữ "sideNavigation" bên dưới phải khớp với thuộc tính id="..." của thẻ <tnt:SideNavigation> trong file App.view.xml của sếp nha!
            var oSideNav = this.byId("sideNavigation"); 
            
            if (oSideNav && sRouteName) {
                // Ép thanh menu phải sáng lên ở đúng cái Key tương ứng với tên trang
                oSideNav.setSelectedKey(sRouteName);
            }
        },

        // Hàm xử lý khi bấm nút "3 gạch" trên header để thu gọn/mở rộng menu
        onCollapseExpandPress: function () {
            var oToolPage = this.byId("toolPage"); // Bạn kiểm tra xem id thẻ ToolPage ở App.view.xml đúng là "toolPage" chưa nhé
            if (oToolPage) {
                var bExpanded = oToolPage.getSideExpanded();
                oToolPage.setSideExpanded(!bExpanded);
            }
        },

        // Hàm xử lý khi bấm vào các mục menu bên trái (Tự động điều hướng động)
        onItemSelect: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            var sKey = oItem.getKey(); // Bắt cái key mình đã khai báo ở XML (dashboard, timesheet, employee-config...)


            if (sKey) {
                // Gọi Router hệ thống để thực hiện đổi màn hình tự động dựa vào key
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo(sKey);
            }
        }

    });
});