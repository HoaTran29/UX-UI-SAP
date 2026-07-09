sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator"
], function (Controller, MessageToast, BusyIndicator) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Dispute", {
        
        onInit: function () {
        },

        // 1. MỞ POPUP XỬ LÝ
        onOpenDialog: function (oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext(); // Lấy data của dòng đang bấm
            var oDialog = this.byId("approveDialog");
            
            // Ép data của dòng vào Popup để hiện lên TimePicker
            oDialog.setBindingContext(oContext);
            oDialog.open();
        },

        // 2. HỦY & ĐÓNG POPUP
        onCancelDialog: function () {
            // Nếu Manager gõ bậy bạ mà không lưu, reset lại data cho sạch
            this.getView().getModel().resetChanges();
            this.byId("approveDialog").close();
        },

        // 3. XÁC NHẬN "LƯU & DUYỆT" TỪ POPUP
        onConfirmApprove: function () {
            var oDialog = this.byId("approveDialog");
            var oContext = oDialog.getBindingContext();
            var oModel = this.getView().getModel();
            var sDisputeId = oContext.getProperty("DisputeId");

            BusyIndicator.show(0);

            // Kiểm tra: Nếu Manager có chỉnh sửa giờ trong Pop-up
            if (oModel.hasPendingChanges()) {
                // Phải lưu cái giờ mới xuống Database Dispute trước
                oModel.submitChanges({
                    success: function() {
                        // Lưu giờ thành công, kích hoạt tiếp Action Duyệt
                        this._callApproveAction(sDisputeId, oModel, oDialog);
                    }.bind(this),
                    error: function() {
                        BusyIndicator.hide();
                        MessageToast.show("Lỗi mạng khi lưu giờ chốt!");
                    }
                });
            } else {
                // Nếu Manager không sửa gì, chỉ nhìn rồi duyệt thì bắn Action luôn
                this._callApproveAction(sDisputeId, oModel, oDialog);
            }
        },

        // Nút Từ Chối ngoài bảng vẫn giữ nguyên logic
        onReject: function (oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext();
            var sDisputeId = oContext.getProperty("DisputeId");
            var oModel = this.getView().getModel();

            BusyIndicator.show(0);
            this._callRejectAction(sDisputeId, oModel);
        },

        // 4. HÀM CHUYÊN GỌI ACTION DUYỆT XUỐNG BACKEND
        _callApproveAction: function(sDisputeId, oModel, oDialog) {
            // Lưu ý: Tùy SAP cấu hình, Action đôi khi tên là 'Approve' hoặc 'DisputeApprove'
            oModel.callFunction("/Approve", { 
                method: "POST",
                urlParameters: { DisputeId: sDisputeId },
                success: function () {
                    BusyIndicator.hide();
                    MessageToast.show("Đã DUYỆT đơn và tự động cập nhật Timesheet!");
                    oDialog.close();
                    oModel.refresh(); // Tải lại bảng, đơn sẽ bay màu vì hết PENDING
                },
                error: function (oError) {
                    BusyIndicator.hide();
                    MessageToast.show("Lỗi xử lý duyệt từ Backend SAP!");
                }
            });
        },

        // HÀM CHUYÊN GỌI ACTION TỪ CHỐI
        _callRejectAction: function(sDisputeId, oModel) {
            oModel.callFunction("/Reject", { 
                method: "POST",
                urlParameters: { DisputeId: sDisputeId },
                success: function () {
                    BusyIndicator.hide();
                    MessageToast.show("Đã TỪ CHỐI đơn report!");
                    oModel.refresh(); 
                },
                error: function (oError) {
                    BusyIndicator.hide();
                    MessageToast.show("Lỗi từ hệ thống khi từ chối!");
                }
            });
        }
    });
});