sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator",
    "sap/ui/core/Fragment"
], function (Controller, MessageToast, BusyIndicator, Fragment) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Dispute", {

        onInit: function () {
        },

        // 1. MỞ POPUP XỬ LÝ (DUYỆT)
        onOpenDialog: function (oEvent) {
            var oView = this.getView();
            var oContext = oEvent.getSource().getBindingContext();

            if (!this._pApproveDialog) {
                this._pApproveDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.ApproveDialog", // Trỏ tới file mới
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pApproveDialog.then(function (oDialog) {
                oDialog.setBindingContext(oContext);
                oDialog.open();
            });
        },

        // 2. HỦY & ĐÓNG POPUP (DUYỆT)
        onCancelDialog: function () {
            this.getView().getModel().resetChanges();
            this.byId("approveDialog").close();
        },

        // 3. XÁC NHẬN DUYỆT
        onConfirmApprove: function () {
            var oView = this.getView();
            var oDialog = this.byId("approveDialog");
            var oContext = oDialog.getBindingContext();
            var oModel = this.getView().getModel();
            var sDisputeId = oContext.getProperty("DisputeId");

            var oTextArea = this.byId("approveNoteInput");
            if (oTextArea) {
                var sNote = oTextArea.getValue().trim();

                // 2. LOGIC MẶC ĐỊNH: Nếu không nhập gì thì tự gán chữ "ĐÃ DUYỆT"
                if (!sNote) {
                    sNote = "ĐÃ DUYỆT";
                }
                oModel.setProperty(oContext.getPath() + "/ApproverComment", sNote); 
            }

            BusyIndicator.show(0);

            if (oModel.hasPendingChanges()) {
                oModel.submitChanges({
                    success: function () {
                        this._callApproveAction(sDisputeId, oModel, oDialog);
                    }.bind(this),
                    error: function () {
                        BusyIndicator.hide();
                        sap.m.MessageToast.show("Lỗi mạng khi lưu dữ liệu trước khi duyệt!");
                    }
                });
            } else {
                this._callApproveAction(sDisputeId, oModel, oDialog);
            }
        },

        // 4. HÀM CHUYÊN GỌI ACTION DUYỆT XUỐNG BACKEND (Đã sửa /ApproveDispute thành /Approve)
        _callApproveAction: function (sDisputeId, oModel, oDialog) {
            oModel.callFunction("/Approve", {  // <--- ĐỔI TÊN Ở ĐÂY CHO KHỚP BDEF
                method: "POST",
                urlParameters: { DisputeId: sDisputeId },
                success: function () {
                    BusyIndicator.hide();
                    MessageToast.show("Đã DUYỆT đơn và tự động cập nhật Timesheet!");
                    if (oDialog) oDialog.close(); // Đóng popup
                    oModel.refresh();
                },
                error: function (oError) {
                    BusyIndicator.hide();
                    MessageToast.show("Lỗi xử lý duyệt từ Backend SAP!");
                }
            });
        },

        // ==============================================================
        // KHU VỰC TỪ CHỐI
        // ==============================================================

        // 1. MỞ POPUP TỪ CHỐI
        onOpenRejectDialog: function (oEvent) {
            var oView = this.getView();
            var oContext = oEvent.getSource().getBindingContext();

            if (!this._pRejectDialog) {
                this._pRejectDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.RejectDialog", // Trỏ tới file mới
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pRejectDialog.then(function (oDialog) {
                oDialog.setBindingContext(oContext);
                oDialog.open();
            });
        },

        // 2. HỦY & ĐÓNG POPUP TỪ CHỐI
        onCancelReject: function () {
            this.getView().getModel().resetChanges();
            this.byId("rejectDialog").close();
        },

        // 3. XÁC NHẬN TỪ CHỐI BÊN TRONG POPUP
        onConfirmReject: function () {
            var oView = this.getView();
            var oDialog = this.byId("rejectDialog");
            var oContext = oDialog.getBindingContext();
            var oModel = this.getView().getModel();
            var sDisputeId = oContext.getProperty("DisputeId");

            var oTextArea = this.byId("rejectReasonInput");
            var sReason = oTextArea.getValue().trim();

            if (!sReason) {
                sap.m.MessageToast.show("Vui lòng nhập lý do từ chối!");
                oTextArea.setValueState("Error");
                return;
            } else {
                oTextArea.setValueState("None");
            }

            if (oTextArea) {
                var sNote = oTextArea.getValue();
                oModel.setProperty(oContext.getPath() + "/ApproverComment", sNote);
            }

            BusyIndicator.show(0);

            if (oModel.hasPendingChanges()) {
                oModel.submitChanges({
                    success: function () {
                        this._callRejectAction(sDisputeId, oModel, oDialog);
                    }.bind(this),
                    error: function () {
                        BusyIndicator.hide();
                        sap.m.MessageToast.show("Lỗi mạng: Không thể lưu lý do từ chối!");
                    }
                });
            } else {
                this._callRejectAction(sDisputeId, oModel, oDialog);
            }
        },

        // 4. HÀM CHUYÊN GỌI ACTION TỪ CHỐI (Đã gom 2 hàm trùng lại làm 1, sửa thành /Reject)
        _callRejectAction: function (sDisputeId, oModel, oDialog) {
            oModel.callFunction("/Reject", {
                method: "POST",
                urlParameters: { DisputeId: sDisputeId },
                success: function () {
                    BusyIndicator.hide();
                    MessageToast.show("Đã TỪ CHỐI đơn report!");
                    if (oDialog) {
                        oDialog.close();
                    }
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