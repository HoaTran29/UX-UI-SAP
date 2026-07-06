sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.App", {
        
        onInit: function () {
            // Khởi tạo ứng dụng gốc
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