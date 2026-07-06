sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
], function (Controller, MessageToast) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.App", {
        
        onInit: function () {
        },

        // Xử lý hiệu ứng thu/phóng khi bấm vào nút Menu (Hamburger)
        onCollapseExpandPress: function () {
            var oToolPage = this.byId("toolPage");
            var bSideExpanded = oToolPage.getSideExpanded();
            
            // Đảo ngược trạng thái hiện tại (Đang mở thì đóng, đang đóng thì mở)
            oToolPage.setSideExpanded(!bSideExpanded);
        },

        // Xử lý nhảy trang khi click vào các dòng Menu
        onItemSelect: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            var sKey = oItem.getKey();
            
            // Bẫy lỗi: Vì trong manifest.json ông chưa có route cho "timesheet" và "employee"
            // Nên tui chặn lại để nó khỏi báo lỗi văng app, khi nào rảnh code 2 trang đó sau
            if (sKey === "timesheet" || sKey === "employee") {
                MessageToast.show("Tính năng này đang được phát triển!");
                return;
            }

            // Lấy Router và nhảy sang trang (Ví dụ sKey = 'dashboard', 'schedule', 'dispute', 'holiday')
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo(sKey);
        }

    });
});