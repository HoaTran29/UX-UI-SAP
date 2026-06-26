sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Dashboard", {
        onInit: function () {
            // Khởi tạo các cấu hình ban đầu nếu cần
        },

        // Hàm click vào thẻ Tile "Đơn Report" để nhảy nhanh sang trang Phê duyệt
        onGoToDispute: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("dispute"); // Lát mình cấu hình route này sau
        }
    });
});