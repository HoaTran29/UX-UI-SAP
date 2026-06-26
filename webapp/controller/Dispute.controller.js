sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator"
], function (Controller, MessageToast, BusyIndicator) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Dispute", {
        
        onInit: function () {
        },

        // Hàm gọi khi sếp bấm nút "Duyệt"
        onApprove: function (oEvent) {
            this._callAction(oEvent, "DisputeApprove", "Đã duyệt đơn và cập nhật Timesheet thành công!");
        },

        // Hàm gọi khi sếp bấm nút "Từ chối"
        onReject: function (oEvent) {
            this._callAction(oEvent, "DisputeReject", "Đã từ chối đơn report!");
        },

        // Hàm dùng chung để gọi OData Function Import
        _callAction: function (oEvent, sActionName, sSuccessMessage) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext();
            var sDisputeId = oContext.getProperty("DisputeId"); // Lấy ID của đơn đang chọn
            var oModel = this.getView().getModel();

            BusyIndicator.show(0);

            // Gọi OData Function (Hệ thống RAP tự động gen tên Action theo cú pháp <TênEntity><TênAction>)
            oModel.callFunction("/" + sActionName, {
                method: "POST",
                urlParameters: {
                    DisputeId: sDisputeId
                },
                success: function () {
                    BusyIndicator.hide();
                    MessageToast.show(sSuccessMessage);
                    oModel.refresh(); // Tự động load lại bảng cho dữ liệu biến mất khỏi danh sách PENDING
                },
                error: function (oError) {
                    BusyIndicator.hide();
                    MessageToast.show("Có lỗi xảy ra từ hệ thống SAP!");
                    console.error(oError);
                }
            });
        }
    });
});