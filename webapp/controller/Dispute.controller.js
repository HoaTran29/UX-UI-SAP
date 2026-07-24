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

onConfirmApprove: function () {
            var oDialog = this.byId("approveDialog");
            var oContext = oDialog.getBindingContext();
            var oModel = this.getView().getModel();
            var sDisputeId = oContext.getProperty("DisputeId");

            BusyIndicator.show(0);

            if (oModel.hasPendingChanges()) {
                oModel.submitChanges({
                    success: function() {
                        this._callApproveAction(sDisputeId, oModel, oDialog);
                    }.bind(this),
                    error: function() {
                        BusyIndicator.hide();
                        sap.m.MessageToast.show("Lỗi mạng khi lưu giờ mới!");
                    }
                });
            } else {
                this._callApproveAction(sDisputeId, oModel, oDialog);
            }
        },

        // Nút Từ Chối ngoài bảng vẫn giữ nguyên logic
        // 1. NÚT TỪ CHỐI Ở BẢNG -> MỞ POPUP TỪ CHỐI
        onOpenRejectDialog: function (oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext();
            var oDialog = this.byId("rejectDialog");
            
            // Ép data của dòng hiện tại vào popup
            oDialog.setBindingContext(oContext);
            oDialog.open();
        },

        // 2. NÚT HỦY BÊN TRONG POPUP TỪ CHỐI
        onCancelReject: function () {
            // Xóa rác nếu người dùng có gõ chữ nhưng không lưu
            this.getView().getModel().resetChanges();
            this.byId("rejectDialog").close();
        },

        // 3. NÚT "XÁC NHẬN TỪ CHỐI" BÊN TRONG POPUP
        onConfirmReject: function () {
            var oDialog = this.byId("rejectDialog");
            var oContext = oDialog.getBindingContext();
            var oModel = this.getView().getModel();
            var sDisputeId = oContext.getProperty("DisputeId");

            BusyIndicator.show(0);

            // Kiểm tra xem Quản lý có gõ lý do vào ô TextArea không
            if (oModel.hasPendingChanges()) {
                // Có gõ -> Lưu lý do xuống Database trước
                oModel.submitChanges({
                    success: function() {
                        // Lưu text thành công thì bắn Action đổi trạng thái
                        this._callRejectAction(sDisputeId, oModel, oDialog);
                    }.bind(this),
                    error: function() {
                        BusyIndicator.hide();
                        MessageToast.show("Lỗi mạng khi lưu lý do!");
                    }
                });
            } else {
                // Không gõ lý do -> Vẫn cho từ chối
                this._callRejectAction(sDisputeId, oModel, oDialog);
            }
        },

        // 4. HÀM CHUYÊN GỌI ACTION TỪ CHỐI (Sửa lại để nhận thêm oDialog)
        _callRejectAction: function(sDisputeId, oModel, oDialog) {
            oModel.callFunction("/RejectDispute", { 
                method: "POST",
                urlParameters: { DisputeId: sDisputeId },
                success: function () {
                    BusyIndicator.hide();
                    MessageToast.show("Đã TỪ CHỐI đơn report!");
                    if(oDialog) {
                        oDialog.close(); // Đóng popup
                    }
                    oModel.refresh(); // Load lại bảng
                },
                error: function (oError) {
                    BusyIndicator.hide();
                    MessageToast.show("Lỗi từ hệ thống khi từ chối!");
                }
            });
        },

        // 4. HÀM CHUYÊN GỌI ACTION DUYỆT XUỐNG BACKEND
        _callApproveAction: function(sDisputeId, oModel, oDialog) {
            // Lưu ý: Tùy SAP cấu hình, Action đôi khi tên là 'Approve' hoặc 'DisputeApprove'
            oModel.callFunction("/ApproveDispute", { 
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