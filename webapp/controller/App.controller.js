sap.ui.define([
    "sap/ui/core/mvc/Controller"
],
    function (Controller) {
        "use strict";

        return Controller.extend("com.app.zu26g13.app.controller.App", {
            onInit: function () {
                sap.ui.define([
                    "sap/ui/core/mvc/Controller"
                ], function (Controller) {
                    "use strict";

                    return Controller.extend("com.hr.hrportal.controller.App", { // Tên namespace này giữ nguyên như code tự sinh của ông nhé

                        onInit: function () {
                        },

                        // Hàm xử lý khi bấm nút "3 gạch" trên header
                        onCollapseExpandPress: function () {
                            var oToolPage = this.byId("toolPage");
                            var bExpanded = oToolPage.getSideExpanded();
                            oToolPage.setSideExpanded(!bExpanded);
                        },

                        // Hàm xử lý khi bấm vào 1 dòng menu bên trái
                        onItemSelect: function (oEvent) {
                            var oItem = oEvent.getParameter("item");
                            var sKey = oItem.getKey();

                            // Console log để check xem sự kiện bấm đã ăn chưa. 
                            // Lát nữa mình sẽ dùng sKey này để điều hướng (Routing) sang các view tương ứng
                            console.log("Chuyển trang sang: " + sKey);
                        },
                        onItemSelect: function (oEvent) {
                            var oItem = oEvent.getParameter("item");
                            var sKey = oItem.getKey(); // Bắt cái key mình đã khai báo ở XML (dashboard, holiday,...)

                            // Gọi Router để đổi màn hình
                            var oRouter = this.getOwnerComponent().getRouter();

                            // Tạm thời mình mới cấu hình 2 trang này, mấy trang khác bấm chưa có tác dụng
                            if (sKey === "dashboard" || sKey === "holiday") {
                                oRouter.navTo(sKey);
                            }
                        }

                    });
                });
            }
        });
    });
