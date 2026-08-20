sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator",
    "sap/ui/core/Fragment"
], function (Controller, MessageToast, BusyIndicator, Fragment) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Dispute", {

        onInit: function () {},

        _getI18nText: function (sKey) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey);
        },

        // ==============================================================
        // logic phê duyệt (approve)
        // ==============================================================
        onOpenDialog: function (oEvent) {
            var oView = this.getView();
            var oContext = oEvent.getSource().getBindingContext();

            if (!this._pApproveDialog) {
                this._pApproveDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.ApproveDialog",
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

        onCancelDialog: function () {
            this.getView().getModel().resetChanges();
            this.byId("approveDialog").close();
        },

        onConfirmApprove: function () {
            var oDialog = this.byId("approveDialog");
            var oContext = oDialog.getBindingContext();
            var oModel = this.getView().getModel();
            var sDisputeId = oContext.getProperty("DisputeId");
            var oTextArea = this.byId("approveNoteInput");

            // tự động điền chữ "APPROVED" nếu không comment
            if (oTextArea) {
                var sNote = oTextArea.getValue().trim() || "APPROVED";
                if (!oTextArea.getValue().trim()) oTextArea.setValue(sNote);
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
                        MessageToast.show(this._getI18nText("msgSaveError"));
                    }.bind(this)
                });
            } else {
                this._callApproveAction(sDisputeId, oModel, oDialog);
            }
        },

        _callApproveAction: function (sDisputeId, oModel, oDialog) {
            oModel.callFunction("/Approve", { 
                method: "POST",
                urlParameters: { DisputeId: sDisputeId },
                success: function () {
                    BusyIndicator.hide();
                    MessageToast.show(this._getI18nText("msgApproveSuccess"));
                    if (oDialog) oDialog.close();
                    oModel.refresh();
                }.bind(this),
                error: function () {
                    BusyIndicator.hide();
                    MessageToast.show(this._getI18nText("msgApproveError"));
                }.bind(this)
            });
        },

        // ==============================================================
        // logic từ chối (reject)
        // ==============================================================
        onOpenRejectDialog: function (oEvent) {
            var oView = this.getView();
            var oContext = oEvent.getSource().getBindingContext();

            if (!this._pRejectDialog) {
                this._pRejectDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.RejectDialog",
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

        onCancelReject: function () {
            this.getView().getModel().resetChanges();
            this.byId("rejectDialog").close();
        },

        onConfirmReject: function () {
            var oDialog = this.byId("rejectDialog");
            var oContext = oDialog.getBindingContext();
            var oModel = this.getView().getModel();
            var sDisputeId = oContext.getProperty("DisputeId");
            var oTextArea = this.byId("rejectReasonInput");
            var sReason = oTextArea.getValue().trim();

            // từ chối thì bắt buộc phải nhập lý do
            if (!sReason) {
                MessageToast.show(this._getI18nText("msgRejectEmptyReason"));
                oTextArea.setValueState("Error");
                return;
            } 
            
            oTextArea.setValueState("None");
            oModel.setProperty(oContext.getPath() + "/ApproverComment", sReason);

            BusyIndicator.show(0);

            if (oModel.hasPendingChanges()) {
                oModel.submitChanges({
                    success: function () {
                        this._callRejectAction(sDisputeId, oModel, oDialog);
                    }.bind(this),
                    error: function () {
                        BusyIndicator.hide();
                        MessageToast.show(this._getI18nText("msgRejectSaveError"));
                    }.bind(this)
                });
            } else {
                this._callRejectAction(sDisputeId, oModel, oDialog);
            }
        },

        _callRejectAction: function (sDisputeId, oModel, oDialog) {
            oModel.callFunction("/Reject", {
                method: "POST",
                urlParameters: { DisputeId: sDisputeId },
                success: function () {
                    BusyIndicator.hide();
                    MessageToast.show(this._getI18nText("msgRejectSuccess"));
                    if (oDialog) oDialog.close();
                    oModel.refresh();
                }.bind(this),
                error: function () {
                    BusyIndicator.hide();
                    MessageToast.show(this._getI18nText("msgRejectError"));
                }.bind(this)
            });
        }
    });
});